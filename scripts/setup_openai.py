#!/usr/bin/env python3
"""
Enhanced OpenAI API Setup for MEXC Sniper Bot
Configures OpenAI API keys and integrates with Codex multi-agent system
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, Optional

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

# Configuration
PROJECT_ROOT = Path(__file__).parent.parent
CONFIG_FILE = PROJECT_ROOT / ".openai_config.json"
ENV_FILE = PROJECT_ROOT / ".env"
CODEX_DIR = PROJECT_ROOT / ".codex"

class OpenAISetup:
    """Enhanced OpenAI setup with Codex integration"""
    
    def __init__(self):
        self.config = self.load_config()
        
    def load_config(self) -> Dict:
        """Load existing configuration"""
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, 'r') as f:
                    return json.load(f)
            except json.JSONDecodeError:
                print(f"Warning: {CONFIG_FILE} is corrupted. Creating new config.")
        return {}
    
    def save_config(self, config: Dict):
        """Save configuration to file"""
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
    
    def get_api_key_from_env(self) -> Optional[str]:
        """Get API key from environment variables"""
        # Check direct environment variable
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            return api_key
            
        # Check .env file
        if ENV_FILE.exists():
            with open(ENV_FILE, 'r') as f:
                for line in f:
                    if line.startswith("OPENAI_API_KEY="):
                        return line.split("=", 1)[1].strip().strip('"\'')
        
        return None
    
    def validate_api_key(self, api_key: str) -> bool:
        """Validate API key by making a test request"""
        if not OPENAI_AVAILABLE:
            print("Warning: OpenAI library not installed. Cannot validate key.")
            return True  # Assume valid if we can't test
        
        try:
            client = OpenAI(api_key=api_key)
            # Test with a minimal request
            client.models.list()
            return True
        except Exception as e:
            print(f"API key validation failed: {e}")
            return False
    
    def update_env_file(self, api_key: str):
        """Update or create .env file with API key"""
        env_lines = []
        found = False
        
        if ENV_FILE.exists():
            with open(ENV_FILE, 'r') as f:
                env_lines = f.readlines()
        
        # Update existing or add new
        for i, line in enumerate(env_lines):
            if line.startswith("OPENAI_API_KEY="):
                env_lines[i] = f'OPENAI_API_KEY="{api_key}"\n'
                found = True
                break
        
        if not found:
            env_lines.append(f'OPENAI_API_KEY="{api_key}"\n')
        
        with open(ENV_FILE, 'w') as f:
            f.writelines(env_lines)
    
    def setup_codex_integration(self):
        """Set up Codex multi-agent integration"""
        print("\n🤖 Setting up Codex multi-agent integration...")
        
        # Ensure Codex directory exists
        CODEX_DIR.mkdir(exist_ok=True)
        
        # Check if setup script exists and run it
        setup_script = CODEX_DIR / "setup.py"
        if setup_script.exists():
            print("Running Codex setup script...")
            os.system(f"cd {PROJECT_ROOT} && python {setup_script}")
        
        # Create quick access scripts
        self.create_helper_scripts()
        
        print("✅ Codex integration ready!")
        print("\nAvailable commands:")
        print("- make codex-review <files>  # AI code review")
        print("- make codex-docs <files>    # Generate documentation")
        print("- make codex-test <files>    # Generate tests")
    
    def create_helper_scripts(self):
        """Create helper scripts for common Codex workflows"""
        
        # Add to Makefile
        makefile_additions = """
# ==================== AI/Codex Commands ====================

.PHONY: codex-review
codex-review: ## Run AI code review on changed files
	@echo -e "${BLUE}Running AI code review...${NC}"
	@$(PYTHON) .codex/agents.py --workflow review --files $(FILES) --output ai-review.json
	@echo -e "${GREEN}✓ Review complete. Check ai-review.json${NC}"

.PHONY: codex-docs
codex-docs: ## Generate AI documentation for files
	@echo -e "${BLUE}Generating AI documentation...${NC}"
	@$(PYTHON) .codex/agents.py --workflow docs --files $(FILES) --output ai-docs.json
	@echo -e "${GREEN}✓ Documentation generated. Check ai-docs.json${NC}"

.PHONY: codex-test
codex-test: ## Generate AI tests for files
	@echo -e "${BLUE}Generating AI tests...${NC}"
	@$(PYTHON) .codex/agents.py --workflow test --files $(FILES) --output ai-tests.json
	@echo -e "${GREEN}✓ Tests generated. Check ai-tests.json${NC}"

.PHONY: codex-setup
codex-setup: ## Setup OpenAI Codex integration
	@echo -e "${BLUE}Setting up OpenAI Codex...${NC}"
	@$(PYTHON) scripts/setup_openai.py
"""
        
        makefile_path = PROJECT_ROOT / "Makefile"
        if makefile_path.exists():
            with open(makefile_path, 'r') as f:
                content = f.read()
            
            if "codex-review" not in content:
                with open(makefile_path, 'a') as f:
                    f.write(makefile_additions)
                print("✅ Added Codex commands to Makefile")
    
    def interactive_setup(self):
        """Interactive setup process"""
        print("🚀 OpenAI API Setup for MEXC Sniper Bot")
        print("=" * 50)
        
        # Check for existing API key
        existing_key = self.get_api_key_from_env()
        
        if existing_key:
            print(f"✅ Found existing API key: {existing_key[:8]}...")
            
            if self.validate_api_key(existing_key):
                print("✅ API key is valid!")
                
                # Save to config
                self.config["OPENAI_API_KEY"] = existing_key
                self.config["validated"] = True
                self.save_config(self.config)
                
                # Set up Codex integration
                self.setup_codex_integration()
                return
            
            print("❌ API key validation failed. Please enter a new key.")
        
        # Prompt for new API key
        print("\nTo get your OpenAI API key:")
        print("1. Visit: https://platform.openai.com/api-keys")
        print("2. Create a new secret key")
        print("3. Copy the key (starts with 'sk-')")
        
        while True:
            api_key = input("\nEnter your OpenAI API key: ").strip()
            
            if not api_key:
                print("❌ No API key provided.")
                continue
            
            if not api_key.startswith("sk-"):
                print("❌ API key should start with 'sk-'")
                continue
            
            print("🔍 Validating API key...")
            if self.validate_api_key(api_key):
                print("✅ API key is valid!")
                
                # Save configuration
                self.config["OPENAI_API_KEY"] = api_key
                self.config["validated"] = True
                self.save_config(self.config)
                
                # Update .env file
                self.update_env_file(api_key)
                
                # Set environment variable for current session
                os.environ["OPENAI_API_KEY"] = api_key
                
                print(f"✅ Configuration saved to {CONFIG_FILE}")
                print(f"✅ API key added to {ENV_FILE}")
                
                # Set up Codex integration
                self.setup_codex_integration()
                
                return
            
            print("❌ API key validation failed. Please try again.")
    
    def check_setup(self) -> bool:
        """Check if OpenAI is properly set up"""
        api_key = self.get_api_key_from_env()
        if not api_key:
            return False
        
        return self.validate_api_key(api_key)

def load_api_key() -> Optional[str]:
    """Load API key for use in applications"""
    setup = OpenAISetup()
    return setup.get_api_key_from_env()

def main():
    """Main setup function"""
    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        setup = OpenAISetup()
        if setup.check_setup():
            print("✅ OpenAI API is properly configured")
            sys.exit(0)
        else:
            print("❌ OpenAI API is not configured or invalid")
            sys.exit(1)
    
    # Install OpenAI library if not available
    if not OPENAI_AVAILABLE:
        print("📦 Installing OpenAI library...")
        os.system("uv add openai")
        print("✅ OpenAI library installed")
    
    setup = OpenAISetup()
    setup.interactive_setup()
    
    print("\n🎉 Setup complete!")
    print("\nNext steps:")
    print("1. Try: make codex-review FILES=api/agents.py")
    print("2. Try: make codex-docs FILES=src/services/mexc_api.py")
    print("3. Check the .codex/ directory for generated files")

if __name__ == "__main__":
    main()
