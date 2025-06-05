#!/usr/bin/env python3
"""
OpenAI Codex Setup Script for MEXC Sniper Bot
Configures Codex integration for AI-assisted development
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional

# Project configuration for Codex
CODEX_CONFIG = {
    "project_name": "mexc-sniper-bot",
    "description": "AI-powered cryptocurrency trading bot for MEXC exchange",
    "language": "python",
    "framework": ["fastapi", "nextjs", "react"],
    "ai_features": [
        "pattern_detection",
        "trading_strategies", 
        "market_analysis",
        "risk_management"
    ],
    "file_types": [".py", ".ts", ".tsx", ".js", ".jsx"],
    "exclude_dirs": [
        ".git",
        ".next", 
        "node_modules",
        "__pycache__",
        ".pytest_cache",
        ".venv",
        "dist",
        "build"
    ]
}

def create_codex_context() -> Dict:
    """Create context file for Codex to understand the project structure"""
    
    context = {
        "project": CODEX_CONFIG["project_name"],
        "description": CODEX_CONFIG["description"],
        "architecture": {
            "backend": {
                "framework": "FastAPI",
                "language": "Python 3.11+",
                "database": "SQLite/PostgreSQL with SQLModel",
                "cache": "Valkey (Redis-compatible)",
                "ai_framework": "OpenAI GPT-4"
            },
            "frontend": {
                "framework": "Next.js 15",
                "language": "TypeScript",
                "ui_library": "shadcn/ui",
                "styling": "Tailwind CSS"
            },
            "deployment": {
                "platform": "Vercel",
                "orchestration": "Inngest",
                "monitoring": "Built-in health checks"
            }
        },
        "key_components": {
            "api/agents.py": "Main FastAPI application with AI trading agents",
            "src/services/mexc_api.py": "MEXC exchange API integration",
            "src/services/pattern_discovery.py": "AI pattern detection engine",
            "src/components/coin-calendar.tsx": "Interactive calendar component",
            "app/dashboard/page.tsx": "Trading dashboard UI"
        },
        "coding_patterns": {
            "python": [
                "Use type hints for all functions",
                "Follow async/await patterns for I/O operations",
                "Use Pydantic models for data validation",
                "Implement proper error handling with try/except",
                "Use logging for debugging and monitoring"
            ],
            "typescript": [
                "Use React functional components with hooks",
                "Implement proper TypeScript interfaces",
                "Use shadcn/ui components for consistent UI",
                "Follow Next.js 15 app directory structure",
                "Implement proper error boundaries"
            ]
        },
        "ai_context": {
            "trading_concepts": [
                "Pattern detection in cryptocurrency markets",
                "Risk management and position sizing",
                "Real-time market data processing",
                "Automated order execution",
                "Portfolio optimization"
            ],
            "technical_indicators": [
                "Ready state pattern: sts:2, st:2, tt:4",
                "Market timing analysis",
                "Volatility assessment",
                "Liquidity evaluation"
            ]
        }
    }
    
    return context

def scan_project_files() -> List[Dict]:
    """Scan project for relevant files to include in Codex context"""
    
    project_root = Path(__file__).parent.parent
    files = []
    
    for file_type in CODEX_CONFIG["file_types"]:
        for file_path in project_root.rglob(f"*{file_type}"):
            # Skip excluded directories
            if any(excluded in str(file_path) for excluded in CODEX_CONFIG["exclude_dirs"]):
                continue
                
            relative_path = file_path.relative_to(project_root)
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                files.append({
                    "path": str(relative_path),
                    "type": file_type,
                    "size": len(content),
                    "lines": len(content.splitlines()),
                    "description": get_file_description(relative_path, content)
                })
            except (UnicodeDecodeError, PermissionError):
                # Skip binary or protected files
                continue
    
    return files

def get_file_description(file_path: Path, content: str) -> str:
    """Generate description for a file based on its path and content"""
    
    path_str = str(file_path)
    
    # API files
    if "api/" in path_str:
        return "FastAPI endpoint definitions and AI agent implementations"
    
    # Service files
    if "services/" in path_str:
        if "mexc" in path_str:
            return "MEXC exchange API integration and trading functions"
        elif "pattern" in path_str:
            return "AI pattern detection and market analysis"
        elif "cache" in path_str:
            return "Valkey/Redis caching service"
        else:
            return "Core service implementation"
    
    # Component files
    if "components/" in path_str:
        return "React UI components and interactive elements"
    
    # App directory files
    if "app/" in path_str:
        if "dashboard" in path_str:
            return "Trading dashboard and monitoring interface"
        else:
            return "Next.js app directory structure"
    
    # Model files
    if "models.py" in path_str:
        return "Database models and data structures"
    
    # Test files
    if "test" in path_str:
        return "Unit tests and integration tests"
    
    # Configuration files
    if any(config in path_str for config in ["config", "settings"]):
        return "Application configuration and settings"
    
    return "Project source file"

def create_codex_files():
    """Create all necessary Codex configuration files"""
    
    codex_dir = Path(__file__).parent
    codex_dir.mkdir(exist_ok=True)
    
    # Create context file
    context = create_codex_context()
    context_file = codex_dir / "context.json"
    
    with open(context_file, 'w', encoding='utf-8') as f:
        json.dump(context, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Created Codex context: {context_file}")
    
    # Create file index
    files = scan_project_files()
    index_file = codex_dir / "file_index.json"
    
    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump({
            "project": CODEX_CONFIG["project_name"],
            "total_files": len(files),
            "file_types": CODEX_CONFIG["file_types"],
            "files": files
        }, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Created file index: {index_file}")
    
    # Create prompts file
    prompts = create_coding_prompts()
    prompts_file = codex_dir / "prompts.json"
    
    with open(prompts_file, 'w', encoding='utf-8') as f:
        json.dump(prompts, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Created coding prompts: {prompts_file}")

def create_coding_prompts() -> Dict:
    """Create common coding prompts for Codex assistance"""
    
    return {
        "trading_agent": {
            "prompt": "Create a new trading agent class that inherits from the base Agent class and implements pattern detection for cryptocurrency markets",
            "context": "Use the existing pattern discovery service and MEXC API integration",
            "requirements": [
                "Async methods for real-time data processing",
                "Proper error handling and logging",
                "Type hints and docstrings",
                "Integration with the caching service"
            ]
        },
        "react_component": {
            "prompt": "Create a React component for trading interface using shadcn/ui components",
            "context": "Follow the existing component patterns in src/components/",
            "requirements": [
                "TypeScript interfaces for props",
                "Proper state management with hooks",
                "Error boundaries and loading states",
                "Responsive design with Tailwind CSS"
            ]
        },
        "api_endpoint": {
            "prompt": "Create a new FastAPI endpoint for trading operations",
            "context": "Follow the patterns in api/agents.py",
            "requirements": [
                "Pydantic models for request/response",
                "Async operation with proper error handling",
                "Authentication and rate limiting",
                "OpenAPI documentation"
            ]
        },
        "database_model": {
            "prompt": "Create a new SQLModel class for database operations",
            "context": "Follow the patterns in src/models.py",
            "requirements": [
                "Proper table relationships",
                "Type annotations and constraints",
                "Migration compatibility",
                "Timezone-aware datetime fields"
            ]
        }
    }

def main():
    """Main setup function"""
    
    print("🤖 OpenAI Codex Setup for MEXC Sniper Bot")
    print("=" * 50)
    
    try:
        create_codex_files()
        
        print("\n✅ Codex setup complete!")
        print("\nNext steps:")
        print("1. Configure your OpenAI API key in .env")
        print("2. Install the OpenAI Python library: pip install openai")
        print("3. Use the context files to enhance Codex understanding")
        print("\nFiles created:")
        print("- .codex/context.json - Project context for Codex")
        print("- .codex/file_index.json - File structure index")
        print("- .codex/prompts.json - Common coding prompts")
        
    except Exception as e:
        print(f"❌ Setup failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()