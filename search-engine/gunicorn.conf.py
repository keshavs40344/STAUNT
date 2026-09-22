import os
import sys

# Ensure literal $PORT in sys.argv is safely expanded if shell did not evaluate it
port = os.environ.get("PORT", "5000")
for i, arg in enumerate(sys.argv):
    if "$PORT" in arg:
        sys.argv[i] = arg.replace("$PORT", port)
    elif "${PORT}" in arg:
        sys.argv[i] = arg.replace("${PORT}", port)

bind = f"0.0.0.0:{port}"
workers = 2
threads = 4
timeout = 120
loglevel = "info"
accesslog = "-"
errorlog = "-"
