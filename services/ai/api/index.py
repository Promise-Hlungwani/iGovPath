"""Vercel entry point: serves the FastAPI app from main.py as one Python function."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from main import app  # noqa: E402,F401
