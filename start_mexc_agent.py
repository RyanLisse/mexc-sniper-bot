#!/usr/bin/env python3
"""
MEXC Pattern Discovery Agent Startup Script
"""

import os
import subprocess
import sys


def check_environment():
    """Check if required environment variables are set"""
    print("🔍 Checking environment...")

    required_vars = ["OPENAI_API_KEY"]
    optional_vars = ["MEXC_API_KEY", "MEXC_SECRET_KEY"]

    missing_required = []
    missing_optional = []

    for var in required_vars:
        if not os.getenv(var):
            missing_required.append(var)

    for var in optional_vars:
        if not os.getenv(var):
            missing_optional.append(var)

    if missing_required:
        print(f"❌ Missing required environment variables: {', '.join(missing_required)}")
        print("\nPlease set them:")
        for var in missing_required:
            print(f"export {var}='your-{var.lower().replace('_', '-')}'")
        return False

    if missing_optional:
        print(f"⚠️  Optional environment variables not set: {', '.join(missing_optional)}")
        print("   These are needed for authenticated MEXC API calls")

    print("✅ Environment check passed")
    return True

def check_dependencies():
    """Check if required dependencies are installed"""
    print("📦 Checking dependencies...")

    try:
        import agents
        import aiohttp
        import fastapi
        import pydantic
        print("✅ All dependencies installed")
        return True
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("\nInstall dependencies with:")
        print("pip install -r requirements.txt")
        return False

def start_server(host="0.0.0.0", port=8000, reload=True):
    """Start the FastAPI server"""
    print(f"🚀 Starting MEXC Pattern Discovery Agent on {host}:{port}")

    cmd = [
        "uvicorn",
        "api.agents:app",
        "--host", host,
        "--port", str(port)
    ]

    if reload:
        cmd.append("--reload")

    try:
        subprocess.run(cmd, check=True)
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to start server: {e}")
    except FileNotFoundError:
        print("❌ uvicorn not found. Install with: pip install uvicorn")

def show_usage():
    """Show usage information"""
    print("""
🤖 MEXC Pattern Discovery Agent

Usage:
  python start_mexc_agent.py [options]

Options:
  --host HOST     Host to bind to (default: 0.0.0.0)
  --port PORT     Port to bind to (default: 8000)
  --no-reload     Disable auto-reload
  --check-only    Only check environment and dependencies
  --help          Show this help message

Environment Variables:
  OPENAI_API_KEY     Required - Your OpenAI API key
  MEXC_API_KEY       Optional - Your MEXC API key
  MEXC_SECRET_KEY    Optional - Your MEXC secret key

Examples:
  python start_mexc_agent.py
  python start_mexc_agent.py --port 8080
  python start_mexc_agent.py --host localhost --no-reload
  python start_mexc_agent.py --check-only

API Endpoints:
  GET  /api/agents/ping                    - Health check
  POST /api/agents/mexc/pattern-discovery  - Start/stop pattern discovery
  POST /api/agents/mexc/analyze-token      - Analyze specific token
  POST /api/agents/mexc/trading-strategy   - Get trading strategies
  GET  /api/agents/mexc/status             - System status

Quick Test:
  curl http://localhost:8000/api/agents/ping
""")

def main():
    """Main function"""
    import argparse

    parser = argparse.ArgumentParser(description="MEXC Pattern Discovery Agent")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    parser.add_argument("--no-reload", action="store_true", help="Disable auto-reload")
    parser.add_argument("--check-only", action="store_true", help="Only check environment")
    parser.add_argument("--help-usage", action="store_true", help="Show detailed usage")

    args = parser.parse_args()

    if args.help_usage:
        show_usage()
        return

    print("🎯 MEXC Pattern Discovery Agent Startup")
    print("=" * 40)

    # Check environment
    if not check_environment():
        sys.exit(1)

    # Check dependencies
    if not check_dependencies():
        sys.exit(1)

    if args.check_only:
        print("✅ All checks passed - ready to start!")
        return

    # Start server
    print()
    start_server(
        host=args.host,
        port=args.port,
        reload=not args.no_reload
    )

if __name__ == "__main__":
    main()
