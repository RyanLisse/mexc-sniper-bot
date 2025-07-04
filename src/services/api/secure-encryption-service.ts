import {
  isBrowserEnvironment,
  isNodeEnvironment,
} from "@/src/lib/browser-compatible-events";
/**
 * Secure Encryption Service for API Credentials
 *
 * This service provides financial-grade encryption for sensitive data like API keys.
 * It implements:
 * - PBKDF2 key derivation from master key
 * - AES-256-GCM authenticated encryption
 * - Proper salt and nonce generation
 * - Key rotation capability
 * - Secure key storage patterns
 */

import { UniversalCrypto } from "@/src/lib/browser-compatible-events";

// Constants for cryptographic operations
const ALGORITHM = "aes-256-gcm";
const SALT_LENGTH = 32; // 256 bits
const NONCE_LENGTH = 16; // 128 bits for GCM
const _TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const PBKDF2_ITERATIONS = 100000; // OWASP recommendation
const PBKDF2_DIGEST = "sha256";

// Version for key rotation support
const CURRENT_VERSION = 1;

// Encrypted data structure
interface EncryptedData {
  version: number;
  salt: string;
  nonce: string;
  tag: string;
  ciphertext: string;
}

export class SecureEncryptionService {
  private _logger?: {
    info: (message: string, context?: any) => void;
    warn: (message: string, context?: any) => void;
    error: (message: string, context?: any, error?: Error) => void;
    debug: (message: string, context?: any) => void;
  };
  private getLogger() {
    if (!this._logger) {
      this._logger = {
        info: (message: string, context?: any) =>
          console.info("[secure-encryption-service]", message, context || ""),
        warn: (message: string, context?: any) =>
          console.warn("[secure-encryption-service]", message, context || ""),
        error: (message: string, context?: any, error?: Error) =>
          console.error(
            "[secure-encryption-service]",
            message,
            context || "",
            error || ""
          ),
        debug: (message: string, context?: any) =>
          console.debug("[secure-encryption-service]", message, context || ""),
      };
    }
    return this._logger;
  }

  private masterKey: Buffer;
  private keyId: string;

  constructor() {
    // Validate and load master key from environment
    const envKey = process.env.ENCRYPTION_MASTER_KEY;

    if (!envKey) {
      throw new Error(
        "ENCRYPTION_MASTER_KEY environment variable is required. " +
          "Generate a secure key using: openssl rand -base64 32"
      );
    }

    // Validate key format and length
    try {
      this.masterKey = Buffer.from(envKey, "base64");
    } catch (_error) {
      throw new Error(
        "Invalid ENCRYPTION_MASTER_KEY format. " +
          "Key must be base64 encoded. " +
          "Generate using: openssl rand -base64 32"
      );
    }

    if (this.masterKey.length < 32) {
      throw new Error("Master key must be at least 256 bits (32 bytes)");
    }

    // Key ID for rotation tracking (optional)
    this.keyId = process.env.ENCRYPTION_KEY_ID || "default";
  }

  /**
   * Encrypts sensitive data using AES-256-GCM with PBKDF2 key derivation
   */
  encrypt(plaintext: string): string {
    try {
      // Generate cryptographically secure random salt and nonce
      const salt = randomBytes(SALT_LENGTH);
      const nonce = randomBytes(NONCE_LENGTH);

      // Derive encryption key using PBKDF2
      const derivedKey = pbkdf2Sync(
        this.masterKey,
        salt,
        PBKDF2_ITERATIONS,
        KEY_LENGTH,
        PBKDF2_DIGEST
      );

      // Create cipher
      const cipher = createCipheriv(ALGORITHM, derivedKey, nonce);

      // Encrypt data
      const ciphertext = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
      ]);

      // Get authentication tag
      const tag = cipher.getAuthTag();

      // Combine all components into a structured format
      const encryptedData: EncryptedData = {
        version: CURRENT_VERSION,
        salt: salt.toString("base64"),
        nonce: nonce.toString("base64"),
        tag: tag.toString("base64"),
        ciphertext: ciphertext.toString("base64"),
      };

      // Return as base64-encoded JSON
      return Buffer.from(JSON.stringify(encryptedData)).toString("base64");
    } catch (error) {
      this.getLogger().error("[Encryption] Encryption failed:", error);
      throw new Error("Failed to encrypt data");
    }
  }

  /**
   * Decrypts data encrypted with encrypt()
   */
  decrypt(encryptedText: string): string {
    try {
      // Parse the encrypted data structure
      const encryptedData: EncryptedData = JSON.parse(
        Buffer.from(encryptedText, "base64").toString("utf8")
      );

      // Version check for future compatibility
      if (encryptedData.version !== CURRENT_VERSION) {
        throw new Error(
          `Unsupported encryption version: ${encryptedData.version}`
        );
      }

      // Decode components
      const salt = Buffer.from(encryptedData.salt, "base64");
      const nonce = Buffer.from(encryptedData.nonce, "base64");
      const tag = Buffer.from(encryptedData.tag, "base64");
      const ciphertext = Buffer.from(encryptedData.ciphertext, "base64");

      // Derive the same key using PBKDF2
      const derivedKey = pbkdf2Sync(
        this.masterKey,
        salt,
        PBKDF2_ITERATIONS,
        KEY_LENGTH,
        PBKDF2_DIGEST
      );

      // Create decipher
      const decipher = createDecipheriv(ALGORITHM, derivedKey, nonce);
      decipher.setAuthTag(tag);

      // Decrypt and verify authentication
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return plaintext.toString("utf8");
    } catch (error) {
      this.getLogger().error("[Encryption] Decryption failed:", error);

      // Don't leak information about why decryption failed
      throw new Error("Failed to decrypt data");
    }
  }

  /**
   * Re-encrypts data with a new salt and nonce (for key rotation)
   */
  reencrypt(encryptedText: string): string {
    const plaintext = this.decrypt(encryptedText);
    return this.encrypt(plaintext);
  }

  /**
   * Generates a secure random key for initial setup
   */
  static generateSecureKey(): string {
    return randomBytes(32).toString("base64");
  }

  /**
   * Validates if a string is properly encrypted by this service
   */
  isValidEncryptedFormat(encryptedText: string): boolean {
    try {
      const data = JSON.parse(
        Buffer.from(encryptedText, "base64").toString("utf8")
      );

      return (
        typeof data.version === "number" &&
        typeof data.salt === "string" &&
        typeof data.nonce === "string" &&
        typeof data.tag === "string" &&
        typeof data.ciphertext === "string"
      );
    } catch {
      return false;
    }
  }

  /**
   * Masks sensitive data for display (shows first/last 4 chars)
   */
  static maskSensitiveData(
    data: string | undefined | null,
    visibleChars = 4
  ): string {
    // Handle undefined/null data
    if (data === undefined || data === null || typeof data !== "string") {
      return "***undefined***";
    }

    // Handle empty strings
    if (data.length === 0) {
      return "";
    }

    if (data.length <= visibleChars * 2) {
      return "*".repeat(data.length);
    }

    const start = data.substring(0, visibleChars);
    const end = data.substring(data.length - visibleChars);
    const maskLength = Math.max(4, data.length - visibleChars * 2);

    return `${start}${"*".repeat(maskLength)}${end}`;
  }
}

// Singleton instance
let encryptionService: SecureEncryptionService | null = null;

/**
 * Gets the singleton encryption service instance
 */
export function getEncryptionService(): SecureEncryptionService {
  if (!encryptionService) {
    encryptionService = new SecureEncryptionService();
  }
  return encryptionService;
}

/**
 * Utility function to generate a new master key
 */
export function generateMasterKey(): void {
  const key = SecureEncryptionService.generateSecureKey();
  console.info("\n🔐 Generated new master encryption key:");
  console.info(`ENCRYPTION_MASTER_KEY="${key}"`);
  console.info("\n⚠️  Add this to your .env.local file and keep it secure!");
  console.info("⚠️  Never commit this key to version control!");
  console.info("⚠️  Loss of this key means loss of all encrypted data!\n");
}

// For testing and key generation
if (require.main === module) {
  generateMasterKey();
}
