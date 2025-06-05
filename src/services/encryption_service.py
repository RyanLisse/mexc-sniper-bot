"""
Encryption service for securely storing API credentials
"""
import base64
import logging
import os
from typing import Optional

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logger = logging.getLogger(__name__)


class EncryptionService:
    """Service for encrypting and decrypting sensitive data"""
    
    def __init__(self, encryption_key: Optional[str] = None):
        """Initialize encryption service with key"""
        if encryption_key:
            self._key = encryption_key.encode()
        else:
            # Generate a key from environment variable or create a new one
            self._key = self._get_or_create_key()
        
        # Derive a Fernet key from the password
        self._fernet = self._create_fernet_key(self._key)
    
    def _get_or_create_key(self) -> bytes:
        """Get encryption key from environment or generate one"""
        env_key = os.getenv("ENCRYPTION_KEY")
        if env_key:
            return env_key.encode()
        
        # For development, use a fixed key (not recommended for production)
        logger.warning("No ENCRYPTION_KEY found in environment. Using development key.")
        return b"development-encryption-key-not-for-production-use"
    
    def _create_fernet_key(self, password: bytes) -> Fernet:
        """Create a Fernet key from password using PBKDF2"""
        # Use a fixed salt for consistency (in production, store this securely)
        salt = b"mexc-sniper-salt"
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password))
        return Fernet(key)
    
    def encrypt(self, data: str) -> str:
        """Encrypt a string and return base64 encoded result"""
        if not data:
            return ""
        
        encrypted_bytes = self._fernet.encrypt(data.encode())
        return base64.b64encode(encrypted_bytes).decode()
    
    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt base64 encoded data and return original string"""
        if not encrypted_data:
            return ""
        
        try:
            encrypted_bytes = base64.b64decode(encrypted_data.encode())
            decrypted_bytes = self._fernet.decrypt(encrypted_bytes)
            return decrypted_bytes.decode()
        except Exception as e:
            logger.error(f"Failed to decrypt data: {e}")
            raise ValueError("Failed to decrypt data")
    
    def encrypt_dict(self, data: dict) -> dict:
        """Encrypt all string values in a dictionary"""
        result = {}
        for key, value in data.items():
            if isinstance(value, str) and value:
                result[key] = self.encrypt(value)
            else:
                result[key] = value
        return result
    
    def decrypt_dict(self, data: dict) -> dict:
        """Decrypt all string values in a dictionary"""
        result = {}
        for key, value in data.items():
            if isinstance(value, str) and value:
                try:
                    result[key] = self.decrypt(value)
                except ValueError:
                    # If decryption fails, return original value
                    result[key] = value
            else:
                result[key] = value
        return result


# Global encryption service instance
_encryption_service: Optional[EncryptionService] = None


def get_encryption_service() -> EncryptionService:
    """Get the global encryption service instance"""
    global _encryption_service
    if _encryption_service is None:
        _encryption_service = EncryptionService()
    return _encryption_service


def encrypt_api_credentials(api_key: str, secret_key: str, passphrase: Optional[str] = None) -> dict:
    """Encrypt API credentials for storage"""
    service = get_encryption_service()
    
    result = {
        "api_key_encrypted": service.encrypt(api_key) if api_key else None,
        "secret_key_encrypted": service.encrypt(secret_key) if secret_key else None,
        "passphrase_encrypted": service.encrypt(passphrase) if passphrase else None,
    }
    
    return result


def decrypt_api_credentials(encrypted_data: dict) -> dict:
    """Decrypt API credentials for use"""
    service = get_encryption_service()
    
    result = {
        "api_key": service.decrypt(encrypted_data.get("api_key_encrypted", "")) if encrypted_data.get("api_key_encrypted") else None,
        "secret_key": service.decrypt(encrypted_data.get("secret_key_encrypted", "")) if encrypted_data.get("secret_key_encrypted") else None,
        "passphrase": service.decrypt(encrypted_data.get("passphrase_encrypted", "")) if encrypted_data.get("passphrase_encrypted") else None,
    }
    
    return result
