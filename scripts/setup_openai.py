# scripts/setup_openai.py

import os
import json

# Configuration variables
CONFIG_FILE = ".openai_config.json"
ENV_VAR_NAME = "OPENAI_API_KEY"

def setup_openai_api():
    """
    Sets up the OpenAI API key.
    Prompts the user for their API key and stores it in a configuration file
    and sets it as an environment variable.
    """
    print("OpenAI API Setup")
    print("----------------")

    # Check if the API key is already set as an environment variable
    api_key_env = os.getenv(ENV_VAR_NAME)
    if api_key_env:
        print(f"Found API key in environment variable {ENV_VAR_NAME}.")
        use_env_key = input("Do you want to use this key? (yes/no): ").strip().lower()
        if use_env_key == 'yes':
            save_config({ENV_VAR_NAME: api_key_env})
            print(f"Configuration saved to {CONFIG_FILE}.")
            print(f"To use the API key in your current session, you might need to source your shell profile or restart your terminal.")
            return

    # Check if the config file already exists
    if os.path.exists(CONFIG_FILE):
        print(f"Configuration file {CONFIG_FILE} already exists.")
        try:
            with open(CONFIG_FILE, 'r') as f:
                config = json.load(f)
            api_key_config = config.get(ENV_VAR_NAME)
            if api_key_config:
                print(f"Found API key in {CONFIG_FILE}.")
                use_config_key = input("Do you want to use this key? (yes/no): ").strip().lower()
                if use_config_key == 'yes':
                    os.environ[ENV_VAR_NAME] = api_key_config
                    print(f"Environment variable {ENV_VAR_NAME} set from config file for the current session.")
                    print(f"To make this permanent, add 'export {ENV_VAR_NAME}="{api_key_config}"' to your shell profile (e.g., .bashrc, .zshrc).")
                    return
        except json.JSONDecodeError:
            print(f"Error reading {CONFIG_FILE}. It might be corrupted.")

    # Prompt the user for the API key
    api_key = input("Please enter your OpenAI API key: ").strip()

    if not api_key:
        print("No API key provided. Exiting setup.")
        return

    # Save the API key to the config file
    save_config({ENV_VAR_NAME: api_key})
    print(f"Configuration saved to {CONFIG_FILE}.")

    # Set the environment variable for the current session
    os.environ[ENV_VAR_NAME] = api_key
    print(f"Environment variable {ENV_VAR_NAME} set for the current session.")
    print(f"To make this permanent, add 'export {ENV_VAR_NAME}="{api_key}"' to your shell profile (e.g., .bashrc, .zshrc).")
    print("Alternatively, you can load the key from the config file in your application.")

def save_config(config_data):
    """Saves the configuration data to the config file."""
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config_data, f, indent=4)

def load_api_key():
    """
    Loads the OpenAI API key from the environment variable or config file.
    Returns the API key if found, otherwise None.
    """
    # Try to get from environment variable first
    api_key = os.getenv(ENV_VAR_NAME)
    if api_key:
        return api_key

    # Try to load from config file
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                config = json.load(f)
            return config.get(ENV_VAR_NAME)
        except json.JSONDecodeError:
            print(f"Error reading {CONFIG_FILE}. Cannot load API key.")
            return None
    return None

if __name__ == "__main__":
    setup_openai_api()
    # Example of how to load the key in your application
    # loaded_key = load_api_key()
    # if loaded_key:
    # print(f"Successfully loaded API key: {loaded_key[:5]}...{loaded_key[-4:]}")
    # else:
    # print("API key not found. Please run the setup script.")
