/**
 * Input sanitization utilities to prevent XSS attacks
 */

// HTML entities to escape
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#96;",
  "=": "&#x3D;",
};

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(input: string): string {
  if (typeof input !== "string") {
    return String(input);
  }

  return input.replace(/[&<>"'`=\/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Remove potentially dangerous HTML tags and attributes
 */
export function stripDangerousTags(input: string): string {
  if (typeof input !== "string") {
    return String(input);
  }

  // Remove script tags and their content
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // Remove other dangerous tags
  const dangerousTags = [
    "script",
    "iframe",
    "object",
    "embed",
    "form",
    "input",
    "button",
    "select",
    "textarea",
    "style",
    "link",
    "meta",
    "title",
    "base",
  ];

  const tagPattern = new RegExp(`<\/?(?:${dangerousTags.join("|")})\\b[^>]*>`, "gi");
  sanitized = sanitized.replace(tagPattern, "");

  // Remove javascript: and data: URLs
  sanitized = sanitized.replace(/javascript\s*:/gi, "");
  sanitized = sanitized.replace(/data\s*:/gi, "");

  // Remove on* event handlers
  sanitized = sanitized.replace(/\son\w+\s*=\s*[^>]*/gi, "");

  return sanitized;
}

/**
 * Sanitize email input
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== "string") {
    return "";
  }

  // Remove any HTML and dangerous characters
  let sanitized = stripDangerousTags(email);
  sanitized = escapeHtml(sanitized);

  // Remove any non-email characters (allow only alphanumeric, @, ., -, _)
  sanitized = sanitized.replace(/[^a-zA-Z0-9@.\-_]/g, "");

  // Limit length
  return sanitized.slice(0, 254); // RFC 5321 limit
}

/**
 * Sanitize name input
 */
export function sanitizeName(name: string): string {
  if (typeof name !== "string") {
    return "";
  }

  // Remove HTML and dangerous content
  let sanitized = stripDangerousTags(name);
  sanitized = escapeHtml(sanitized);

  // Allow letters, spaces, hyphens, apostrophes, and periods
  sanitized = sanitized.replace(/[^a-zA-Z\s\-'.]/g, "");

  // Limit length and trim
  return sanitized.slice(0, 100).trim();
}

/**
 * Sanitize password (minimal sanitization to preserve functionality)
 */
export function sanitizePassword(password: string): string {
  if (typeof password !== "string") {
    return "";
  }

  // Only remove obvious XSS attempts, preserve password complexity
  let sanitized = stripDangerousTags(password);

  // Remove null bytes and control characters except tab, newline, carriage return
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Limit length
  return sanitized.slice(0, 128);
}

/**
 * Sanitize general text input
 */
export function sanitizeText(text: string): string {
  if (typeof text !== "string") {
    return "";
  }

  let sanitized = stripDangerousTags(text);
  sanitized = escapeHtml(sanitized);

  // Remove null bytes and most control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return sanitized.trim();
}

/**
 * Validate and sanitize authentication request data
 */
export interface AuthInput {
  email?: string;
  password?: string;
  name?: string;
}

export interface SanitizedAuthInput {
  email: string;
  password: string;
  name?: string;
}

export function sanitizeAuthInput(input: AuthInput): SanitizedAuthInput {
  const sanitized: SanitizedAuthInput = {
    email: sanitizeEmail(input.email || ""),
    password: sanitizePassword(input.password || ""),
  };

  if (input.name !== undefined) {
    sanitized.name = sanitizeName(input.name);
  }

  return sanitized;
}

/**
 * Additional validation for auth inputs
 */
export function validateAuthInput(input: SanitizedAuthInput): string[] {
  const errors: string[] = [];

  // Email validation
  if (!input.email) {
    errors.push("Email is required");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push("Invalid email format");
  }

  // Password validation
  if (!input.password) {
    errors.push("Password is required");
  } else if (input.password.length < 8) {
    errors.push("Password must be at least 8 characters");
  } else if (input.password.length > 128) {
    errors.push("Password is too long");
  }

  // Name validation (if provided)
  if (input.name !== undefined) {
    if (!input.name.trim()) {
      errors.push("Name is required");
    } else if (input.name.length > 100) {
      errors.push("Name is too long");
    }
  }

  return errors;
}

/**
 * Enhanced password validation using password strength checker
 */
export function validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
  // Import is done dynamically to avoid circular dependencies
  // This would need to be adjusted based on your actual implementation
  const errors: string[] = [];

  if (!password) {
    errors.push("Password is required");
    return { isValid: false, errors };
  }

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain lowercase letters");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain uppercase letters");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain numbers");
  }

  // Check for common passwords
  const commonPasswords = ["password", "password123", "123456", "123456789", "qwerty"];
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push("Password is too common - choose something more unique");
  }

  // Check for sequential patterns
  if (/123456|234567|345678|456789|567890|qwerty|asdfgh/.test(password.toLowerCase())) {
    errors.push('Avoid sequential patterns like "123456" or "qwerty"');
  }

  // Check for excessive repeating
  if (/(.)\1{2,}/.test(password)) {
    errors.push("Avoid repeating the same character many times");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check for suspicious patterns that might indicate an attack
 */
export function detectSuspiciousInput(input: string): boolean {
  if (typeof input !== "string") {
    return false;
  }

  const suspiciousPatterns = [
    // Script injection attempts
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /onload=/i,
    /onerror=/i,
    /onclick=/i,

    // SQL injection attempts (basic)
    /union\s+select/i,
    /drop\s+table/i,
    /delete\s+from/i,

    // Command injection
    /\$\(/,
    /`.*`/,
    /\|\s*\w+/,

    // Data exfiltration attempts
    /data:/i,
    /base64/i,

    // Excessive special characters (potential encoding attack)
    /[%]{3,}/,
    /[&]{3,}/,
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(input));
}
