"""
Inngest function gateway for Vercel.

Route: /api/inngest  (exact path required by Inngest dashboard)
"""

import os
import sys

# Add the project root to Python path for imports
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

try:
    from fastapi import FastAPI

    from inngest.fast_api import serve as serve_inngest
    from src.inngest_app import inngest_functions  # ensures functions are imported
    from src.inngest_client import inngest_client

    app = FastAPI()
    serve_inngest(app, inngest_client, functions=inngest_functions)

except ImportError:
    # Fallback if Inngest not available
    from fastapi import FastAPI

    app = FastAPI()

    @app.get("/")
    async def inngest_not_available():
        return {"error": "Inngest not available"}
