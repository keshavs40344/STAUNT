import os
import sys

_backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

__path__.append(_backend_dir)

if not os.getenv("SECRET_KEY") and not os.getenv("FLASK_ENV"):
    os.environ["FLASK_ENV"] = "development"

# Expose backend modules directly under search_engine
import db
import indexer
import query_engine
import search_core
import search_validator
import crawler
import server
import spell_checker
