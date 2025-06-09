/**
 * Enhanced password validation utilities
 */

// Common weak passwords to reject
const COMMON_WEAK_PASSWORDS = new Set([
  "password",
  "password123",
  "123456",
  "123456789",
  "qwerty",
  "abc123",
  "password1",
  "admin",
  "letmein",
  "welcome",
  "monkey",
  "1234567890",
  "dragon",
  "master",
  "shadow",
  "superman",
  "batman",
  "trustno1",
  "hello",
  "freedom",
  "whatever",
  "secret",
  "love",
  "god",
  "sex",
  "money",
  "life",
  "family",
  "password12",
  "password123!",
  "P@ssw0rd",
  "Password1",
  "Password123",
  "Test123!",
  "admin123",
  "root",
  "toor",
  "administrator",
  "guest",
  "user",
  "demo",
  "test",
  "temp",
  "changeme",
]);

// Sequential patterns to detect
const SEQUENTIAL_PATTERNS = [
  "123456",
  "234567",
  "345678",
  "456789",
  "567890",
  "abcdef",
  "bcdefg",
  "cdefgh",
  "defghi",
  "efghij",
  "qwerty",
  "asdfgh",
  "zxcvbn",
];

export interface PasswordStrength {
  score: number; // 0-4 (very weak to very strong)
  feedback: string[];
  isValid: boolean;
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    symbols: boolean;
    noCommon: boolean;
    noSequential: boolean;
    noRepeating: boolean;
  };
}

/**
 * Comprehensive password strength validation
 */
export function validatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /[0-9]/.test(password),
    symbols: /[^A-Za-z0-9]/.test(password),
    noCommon: !isCommonPassword(password),
    noSequential: !hasSequentialPattern(password),
    noRepeating: !hasExcessiveRepeating(password),
  };

  // Length requirement (minimum 8, bonus for longer)
  if (password.length < 8) {
    feedback.push("Password must be at least 8 characters long");
  } else if (password.length >= 12) {
    score += 2;
  } else {
    score += 1;
  }

  // Character variety
  let varietyCount = 0;

  if (requirements.lowercase) {
    varietyCount++;
  } else {
    feedback.push("Include lowercase letters (a-z)");
  }

  if (requirements.uppercase) {
    varietyCount++;
  } else {
    feedback.push("Include uppercase letters (A-Z)");
  }

  if (requirements.numbers) {
    varietyCount++;
  } else {
    feedback.push("Include numbers (0-9)");
  }

  if (requirements.symbols) {
    varietyCount++;
    score += 1; // Bonus for symbols
  } else {
    feedback.push("Include special characters (!@#$%^&*)");
  }

  score += Math.floor(varietyCount / 2);

  // Common password check
  if (!requirements.noCommon) {
    feedback.push("Password is too common - choose something more unique");
    score = Math.max(0, score - 2);
  }

  // Sequential pattern check
  if (!requirements.noSequential) {
    feedback.push('Avoid sequential patterns like "123456" or "qwerty"');
    score = Math.max(0, score - 1);
  }

  // Excessive repeating characters
  if (!requirements.noRepeating) {
    feedback.push("Avoid repeating the same character many times");
    score = Math.max(0, score - 1);
  }

  // Additional complexity bonus
  if (password.length >= 16) {
    score += 1;
  }

  // Entropy bonus for mixed case with numbers and symbols
  if (
    requirements.uppercase &&
    requirements.lowercase &&
    requirements.numbers &&
    requirements.symbols &&
    password.length >= 12
  ) {
    score += 1;
  }

  // Cap score at 4
  score = Math.min(4, score);

  // Determine if password meets minimum requirements
  const isValid =
    requirements.length &&
    requirements.lowercase &&
    requirements.uppercase &&
    requirements.numbers &&
    requirements.noCommon &&
    requirements.noSequential &&
    requirements.noRepeating;

  return {
    score,
    feedback,
    isValid,
    requirements,
  };
}

/**
 * Check if password is in common passwords list
 */
function isCommonPassword(password: string): boolean {
  const normalizedPassword = password.toLowerCase();
  return COMMON_WEAK_PASSWORDS.has(normalizedPassword);
}

/**
 * Check for sequential patterns
 */
function hasSequentialPattern(password: string): boolean {
  const lowerPassword = password.toLowerCase();

  return SEQUENTIAL_PATTERNS.some(
    (pattern) =>
      lowerPassword.includes(pattern) ||
      lowerPassword.includes(pattern.split("").reverse().join(""))
  );
}

/**
 * Check for excessive repeating characters
 */
function hasExcessiveRepeating(password: string): boolean {
  // Check for 3 or more consecutive identical characters
  return /(.)\1{2,}/.test(password);
}

/**
 * Get password strength description
 */
export function getPasswordStrengthText(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return "Very Weak";
    case 2:
      return "Weak";
    case 3:
      return "Good";
    case 4:
      return "Strong";
    default:
      return "Unknown";
  }
}

/**
 * Get password strength color for UI
 */
export function getPasswordStrengthColor(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return "text-red-500";
    case 2:
      return "text-orange-500";
    case 3:
      return "text-yellow-500";
    case 4:
      return "text-green-500";
    default:
      return "text-gray-500";
  }
}

/**
 * Generate a secure password suggestion
 */
export function generateSecurePassword(length = 16): string {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  const allChars = lowercase + uppercase + numbers + symbols;

  let password = "";

  // Ensure at least one character from each category
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password to avoid predictable patterns
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}
