module.exports = {
  extends: ["next/core-web-vitals"],
  rules: {
    // Allow unused vars that start with underscore (intentional)
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }
    ],
    // Disable explicit any checks in certain API contexts
    "@typescript-eslint/no-explicit-any": [
      "warn",
      {
        "ignoreRestArgs": true
      }
    ],
    // React hooks exhaustive deps - warning instead of error
    "react-hooks/exhaustive-deps": "warn",
    // Allow prefer-const to be warning
    "prefer-const": "warn"
  },
  // Override for specific API route patterns
  overrides: [
    {
      files: ["app/api/**/*.ts", "src/mexc-agents/**/*.ts"],
      rules: {
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-unused-vars": "warn"
      }
    }
  ]
};