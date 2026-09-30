"""
STAUNT — Production Mathematical Calculator Engine
Zero-dependency, safe AST-based mathematical evaluator.
NEVER uses Python eval() or JavaScript eval().
Supports arithmetic, BODMAS/PEMDAS, percentages, powers, square roots, and scientific functions.
"""
import ast
import math
import re

# Supported safe functions from math module
SAFE_MATH_FUNCS = {
    "sqrt": math.sqrt,
    "cbrt": math.cbrt if hasattr(math, "cbrt") else lambda x: x ** (1.0 / 3.0),
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "asin": math.asin,
    "acos": math.acos,
    "atan": math.atan,
    "log": math.log,        # natural log
    "ln": math.log,         # alias for ln
    "log10": math.log10,
    "log2": math.log2,
    "abs": abs,
    "ceil": math.ceil,
    "floor": math.floor,
    "round": round,
    "factorial": math.factorial,
    "exp": math.exp,
}

# Supported constants
SAFE_CONSTANTS = {
    "pi": math.pi,
    "e": math.e,
    "tau": math.tau if hasattr(math, "tau") else 2 * math.pi,
}

# Max allowed exponent to prevent CPU DoS
MAX_EXPONENT = 10000


class SafeEvalVisitor(ast.NodeVisitor):
    """
    Safely walks an AST expression and computes its numerical value.
    Rejects any node type not explicitly whitelisted.
    """

    def visit(self, node):
        method = "visit_" + node.__class__.__name__
        visitor = getattr(self, method, self.generic_visit)
        return visitor(node)

    def generic_visit(self, node):
        raise ValueError(f"Unsupported syntax or operation: {node.__class__.__name__}")

    def visit_Expression(self, node):
        return self.visit(node.body)

    def visit_Constant(self, node):
        if isinstance(node.value, (int, float)):
            return node.value
        raise ValueError(f"Unsupported constant type: {type(node.value).__name__}")

    # Backward compatibility for older Python AST
    def visit_Num(self, node):
        return node.n

    def visit_UnaryOp(self, node):
        operand = self.visit(node.operand)
        if isinstance(node.op, ast.UAdd):
            return +operand
        elif isinstance(node.op, ast.USub):
            return -operand
        raise ValueError(f"Unsupported unary operator: {node.op.__class__.__name__}")

    def visit_BinOp(self, node):
        left = self.visit(node.left)
        right = self.visit(node.right)

        if isinstance(node.op, ast.Add):
            return left + right
        elif isinstance(node.op, ast.Sub):
            return left - right
        elif isinstance(node.op, ast.Mult):
            return left * right
        elif isinstance(node.op, ast.Div):
            if right == 0:
                raise ZeroDivisionError("Cannot divide by zero")
            return left / right
        elif isinstance(node.op, ast.FloorDiv):
            if right == 0:
                raise ZeroDivisionError("Cannot divide by zero")
            return left // right
        elif isinstance(node.op, ast.Mod):
            if right == 0:
                raise ZeroDivisionError("Cannot divide by zero")
            return left % right
        elif isinstance(node.op, ast.Pow):
            if abs(right) > MAX_EXPONENT:
                raise ValueError("Exponent exceeds maximum allowed threshold (10,000)")
            try:
                res = left ** right
                if isinstance(res, complex):
                    raise ValueError("Complex numbers are not supported in basic calculator")
                return res
            except OverflowError:
                raise ValueError("Calculation resulted in numerical overflow")
        raise ValueError(f"Unsupported binary operator: {node.op.__class__.__name__}")

    def visit_Call(self, node):
        if not isinstance(node.func, ast.Name):
            raise ValueError("Only direct named functions can be called")
        func_name = node.func.id.lower()
        if func_name not in SAFE_MATH_FUNCS:
            raise ValueError(f"Unknown or disallowed mathematical function: '{func_name}'")

        args = [self.visit(a) for a in node.args]
        func = SAFE_MATH_FUNCS[func_name]

        # Domain checks
        if func_name in ("sqrt", "log", "ln", "log10", "log2") and args and args[0] < 0:
            raise ValueError(f"Cannot calculate {func_name} of a negative number")
        if func_name == "factorial":
            if not args or args[0] < 0 or not float(args[0]).is_integer() or args[0] > 100:
                raise ValueError("Factorial is only defined for non-negative integers <= 100")
            args[0] = int(args[0])

        try:
            return func(*args)
        except Exception as e:
            raise ValueError(f"Function error in {func_name}: {str(e)}")

    def visit_Name(self, node):
        name = node.id.lower()
        if name in SAFE_CONSTANTS:
            return SAFE_CONSTANTS[name]
        raise ValueError(f"Undefined variable or constant: '{node.id}'")


def format_number(val, commas=False):
    """Format numerical result cleanly."""
    if isinstance(val, bool):
        return str(val)
    if isinstance(val, int):
        return f"{val:,}" if commas else str(val)
    if isinstance(val, float):
        if val.is_integer():
            return f"{int(val):,}" if commas else str(int(val))
        # If very large or very tiny, format with scientific notation
        abs_v = abs(val)
        if (abs_v >= 1e14 or (abs_v > 0 and abs_v < 1e-6)):
            return f"{val:.6e}"
        # Regular float: show up to 8 decimal places stripped of trailing zeroes
        formatted = f"{val:.8f}".rstrip("0").rstrip(".")
        if commas:
            parts = formatted.split(".")
            int_part = f"{int(parts[0]):,}"
            return f"{int_part}.{parts[1]}" if len(parts) > 1 else int_part
        return formatted
    return str(val)


def evaluate_calculator_query(raw_query):
    """
    Main entry point for evaluating calculation queries.
    Returns a dict with status, expression, result, steps, and error if applicable.
    Returns None if the query is not a calculation.
    """
    if not raw_query:
        return None

    query = raw_query.strip()
    if len(query) > 200:
        return None

    # Strip conversational prefixes
    # e.g., "calculate 120*45", "what is 120*45", "solve 2^10"
    calc_prefix_pattern = r"^(?:what\s+is|calculate|compute|solve|evaluate)\s+"
    clean_q = re.sub(calc_prefix_pattern, "", query, flags=re.I).strip()
    if not clean_q:
        return None

    # 1. Percentage patterns:
    # Pattern A: "X% of Y" or "X percent of Y" (e.g. "15% of 2500")
    pct_of_match = re.match(r"^([\d\.]+)\s*(?:%|\s*percent)\s+of\s+([\d\.]+)$", clean_q, re.I)
    if pct_of_match:
        try:
            pct = float(pct_of_match.group(1))
            total = float(pct_of_match.group(2))
            res = (pct / 100.0) * total
            return {
                "type": "calculator",
                "expression": f"{pct:g}% of {total:g}",
                "result": format_number(res),
                "raw_result": res,
                "steps": f"({pct:g} ÷ 100) × {total:g} = {format_number(res)}",
                "error": None
            }
        except Exception as e:
            return {
                "type": "calculator",
                "expression": query,
                "result": "Error",
                "steps": None,
                "error": str(e)
            }

    # Pattern B: "X% off Y" or "X% discount on Y"
    pct_off_match = re.match(r"^([\d\.]+)\s*(?:%|\s*percent)\s*(?:off|discount\s+on)\s+([\d\.]+)$", clean_q, re.I)
    if pct_off_match:
        try:
            pct = float(pct_off_match.group(1))
            original = float(pct_off_match.group(2))
            discount = (pct / 100.0) * original
            final_price = original - discount
            return {
                "type": "calculator",
                "expression": f"{pct:g}% off {original:g}",
                "result": format_number(final_price),
                "raw_result": final_price,
                "steps": f"{original:g} - ({pct:g}% of {original:g}) = {format_number(final_price)} (Saved: {format_number(discount)})",
                "error": None
            }
        except Exception as e:
            return {
                "type": "calculator",
                "expression": query,
                "result": "Error",
                "steps": None,
                "error": str(e)
            }

    # Pattern C: "Y + X%" or "Y - X%" (e.g. "2500 + 10%", "2500 - 15%")
    pct_add_sub_match = re.match(r"^([\d\.]+)\s*([\+\-])\s*([\d\.]+)\s*%$", clean_q)
    if pct_add_sub_match:
        try:
            base_val = float(pct_add_sub_match.group(1))
            op = pct_add_sub_match.group(2)
            pct = float(pct_add_sub_match.group(3))
            delta = (pct / 100.0) * base_val
            final_val = base_val + delta if op == "+" else base_val - delta
            return {
                "type": "calculator",
                "expression": f"{base_val:g} {op} {pct:g}%",
                "result": format_number(final_val),
                "raw_result": final_val,
                "steps": f"{base_val:g} {op} ({pct:g}% of {base_val:g} = {format_number(delta)}) = {format_number(final_val)}",
                "error": None
            }
        except Exception as e:
            return {
                "type": "calculator",
                "expression": query,
                "result": "Error",
                "steps": None,
                "error": str(e)
            }

    # Pattern D: "square root of X"
    sqrt_phrase_match = re.match(r"^(?:square\s*root|sqrt)\s+of\s+([\d\.]+)$", clean_q, re.I)
    if sqrt_phrase_match:
        clean_q = f"sqrt({sqrt_phrase_match.group(1)})"

    # Pattern E: "X percent" alone (e.g. "15%")
    pct_alone_match = re.match(r"^([\d\.]+)\s*%$", clean_q)
    if pct_alone_match:
        try:
            val = float(pct_alone_match.group(1))
            res = val / 100.0
            return {
                "type": "calculator",
                "expression": f"{val:g}%",
                "result": format_number(res),
                "raw_result": res,
                "steps": f"{val:g} ÷ 100 = {format_number(res)}",
                "error": None
            }
        except Exception:
            return None

    # 2. General Expression Normalization:
    # Replace human symbols with Python mathematical symbols
    # 'x' or '×' between numbers or closing bracket -> '*'
    expr = clean_q
    expr = expr.replace("×", "*").replace("÷", "/").replace("^", "**")
    expr = re.sub(r"(?<=\d|\))\s*x\s*(?=\d|\()", "*", expr, flags=re.I)
    # Convert square brackets to parentheses: [2 + 3] -> (2 + 3)
    expr = expr.replace("[", "(").replace("]", ")")

    # Guard: Must contain numbers or valid mathematical tokens
    # Reject queries that look like pure text or search terms
    math_chars = r"^[\d\s\+\-\*\/\(\)\.\%\*\,\^a-zA-Z]+$"
    if not re.match(math_chars, expr):
        return None

    # Check if this has mathematical operators or math functions
    has_operator = any(op in expr for op in ("+", "-", "*", "/", "%", "**"))
    has_math_func = any(f + "(" in expr.lower() for f in SAFE_MATH_FUNCS.keys())
    has_constants = any(re.search(rf"\b{c}\b", expr, re.I) for c in SAFE_CONSTANTS.keys())

    if not (has_operator or has_math_func or has_constants):
        return None

    # Guard: ensure query isn't mostly letters (like "c++ tutorial", "python 3.12", "what to do")
    letters = re.findall(r"[a-zA-Z]", expr)
    allowed_words = set(SAFE_MATH_FUNCS.keys()) | set(SAFE_CONSTANTS.keys())
    found_words = re.findall(r"[a-zA-Z]+", expr)
    for w in found_words:
        if w.lower() not in allowed_words:
            return None

    # 3. Parse AST and safely evaluate
    try:
        # Parse into Abstract Syntax Tree
        parsed = ast.parse(expr, mode="eval")
        visitor = SafeEvalVisitor()
        raw_val = visitor.visit(parsed)

        return {
            "type": "calculator",
            "expression": clean_q,
            "result": format_number(raw_val, commas=False),
            "formatted_result": format_number(raw_val, commas=True),
            "raw_result": raw_val,
            "steps": f"{clean_q} = {format_number(raw_val, commas=True)}",
            "error": None
        }
    except ZeroDivisionError:
        return {
            "type": "calculator",
            "expression": clean_q,
            "result": "Error: Division by zero",
            "raw_result": None,
            "steps": "Division by zero is undefined",
            "error": "Cannot divide by zero"
        }
    except ValueError as ve:
        # If it's a known calculation domain error (e.g. negative sqrt), show error
        err_msg = str(ve)
        if any(kw in err_msg.lower() for kw in ("negative", "overflow", "exponent", "complex")):
            return {
                "type": "calculator",
                "expression": clean_q,
                "result": f"Error: {err_msg}",
                "raw_result": None,
                "steps": None,
                "error": err_msg
            }
        # Otherwise not a valid math expression, do not intercept
        return None
    except Exception:
        return None
