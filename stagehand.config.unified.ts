import { ConstructorParams } from "@browserbasehq/stagehand";

/**
 * Unified Stagehand Configuration for MEXC Sniper Bot
 * 
 * This configuration provides comprehensive AI-powered E2E testing setup with:
 * - Environment-specific configurations (LOCAL/BROWSERBASE)
 * - Enhanced AI model settings for reliable test execution
 * - Performance optimization and caching
 * - Robust error handling and timeout management
 * - CI/CD integration support
 */

// Environment detection
const isCI = process.env.CI === 'true';
const isBrowserbaseEnabled = process.env.STAGEHAND_ENV === "BROWSERBASE" && 
                            process.env.BROWSERBASE_API_KEY && 
                            process.env.BROWSERBASE_PROJECT_ID;
const configEnv = isBrowserbaseEnabled ? "BROWSERBASE" : "LOCAL";

// Model configuration based on environment and requirements
const getModelConfig = () => {
  // Use more capable model in CI for reliability
  if (isCI) {
    return {
      modelName: "gpt-4o", // More reliable for CI
      temperature: 0.1,    // Lower temperature for consistency
      maxTokens: 2000
    };
  }
  
  // Development environment - balance between capability and speed
  return {
    modelName: process.env.STAGEHAND_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    maxTokens: 1500
  };
};

// Timeout configuration based on environment
const getTimeoutConfig = () => {
  if (isCI) {
    return {
      domSettleTimeoutMs: 45000,  // Longer timeouts in CI
      defaultTimeout: 90000,      // 90 seconds for CI
      actionTimeout: 30000,       // 30 seconds per action
      pageLoadTimeout: 60000      // 60 seconds for page loads
    };
  }
  
  // Development timeouts
  return {
    domSettleTimeoutMs: parseInt(process.env.STAGEHAND_TIMEOUT || "30000"),
    defaultTimeout: 60000,       // 60 seconds default
    actionTimeout: 20000,        // 20 seconds per action
    pageLoadTimeout: 45000       // 45 seconds for page loads
  };
};

// Browser configuration
const getBrowserConfig = () => {
  const baseConfig = {
    headless: isCI ? true : (process.env.STAGEHAND_HEADLESS !== "false"),
    
    // Browser launch arguments
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
    ],
    
    // Viewport configuration
    viewport: {
      width: 1280,
      height: 720
    },
    
    // Performance optimizations
    ignoreHTTPSErrors: true,
    acceptDownloads: false,
    
    // Browser context options
    permissions: ['geolocation'],
    
    // DevTools configuration
    devtools: !isCI && process.env.STAGEHAND_DEVTOOLS === "true"
  };
  
  // Additional CI-specific configurations
  if (isCI) {
    baseConfig.args.push(
      '--single-process',
      '--no-crash-upload',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-default-apps'
    );
  }
  
  return baseConfig;
};

// Main configuration object
const config: ConstructorParams = {
  // Environment configuration
  env: isBrowserbaseEnabled ? "BROWSERBASE" : "LOCAL",
  
  // Browserbase configuration (if enabled)
  ...(isBrowserbaseEnabled && {
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    browserbaseSessionCreateParams: {
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      // Additional Browserbase session parameters
      keepAlive: true,
      browserSettings: {
        viewport: { width: 1280, height: 720 }
      }
    }
  }),
  
  // OpenAI configuration
  modelClientOptions: {
    apiKey: process.env.OPENAI_API_KEY || "",
    // Additional OpenAI parameters
    organization: process.env.OPENAI_ORG_ID,
    timeout: 60000, // 60 second timeout for AI calls
    maxRetries: 3,
  },
  
  // Model configuration
  ...getModelConfig(),
  
  // Debugging and logging
  verbose: (() => {
    const verboseLevel = process.env.STAGEHAND_VERBOSE;
    if (verboseLevel === "true" || verboseLevel === "2") return 2;
    if (verboseLevel === "1") return 1;
    return isCI ? 1 : 0; // Moderate logging in CI, quiet in dev
  })(),
  
  // Performance and reliability settings
  enableCaching: process.env.STAGEHAND_CACHE !== "false",
  
  // Timeout configurations
  ...getTimeoutConfig(),
  
  // Browser configuration (LOCAL mode only)
  ...(configEnv === "LOCAL" && {
    browserOptions: getBrowserConfig()
  }),
  
  // Advanced configuration
  // debugDom option removed as it's not part of ConstructorParams interface
  
  // Experimental features removed as they're not part of ConstructorParams interface
  // Advanced configurations can be handled through modelClientOptions if needed
  
  // Test-specific configurations removed as they're not part of ConstructorParams interface
  // Test configurations should be handled in test setup files
  
  // Error handling and network configurations removed as they're not part of ConstructorParams interface
  // Advanced configurations should be handled in test setup if needed
};

// Validation
if (config.env === "BROWSERBASE" && (!config.apiKey || !config.projectId)) {
  console.warn("⚠️ Browserbase environment selected but API key or project ID missing. Falling back to LOCAL mode.");
  config.env = "LOCAL";
}

if (!config.modelClientOptions?.apiKey) {
  console.warn("⚠️ OpenAI API key not found. Some AI-powered features may not work.");
}

// Environment-specific adjustments
if (isCI) {
  console.log("🤖 Stagehand configured for CI environment with enhanced reliability settings");
} else {
  console.log(`🚀 Stagehand configured for ${config.env} development environment`);
}

export default config;