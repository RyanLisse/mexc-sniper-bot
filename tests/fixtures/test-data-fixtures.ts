/**
 * Comprehensive Test Data Fixtures for E2E Testing
 * Provides consistent, reliable test data for all E2E test workflows
 */

export interface UserPersona {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'basic' | 'premium' | 'admin';
  profile: {
    riskTolerance: 'low' | 'medium' | 'high';
    tradingExperience: 'beginner' | 'intermediate' | 'expert';
    preferredPatterns: string[];
    maxPositionSize: number;
    dailyTradingLimit: number;
  };
  apiCredentials: {
    mexcApiKey: string;
    mexcSecretKey: string;
    isValid: boolean;
  };
  settings: {
    theme: 'light' | 'dark';
    notifications: boolean;
    autoSnipingEnabled: boolean;
    riskManagementEnabled: boolean;
  };
}

export interface TradingFixture {
  symbol: string;
  type: 'market' | 'limit' | 'stop';
  side: 'buy' | 'sell';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  expectedResult: 'success' | 'failure' | 'warning';
  expectedError?: string;
}

export interface PatternDetectionFixture {
  id: string;
  symbol: string;
  patternType: 'ready_state' | 'pre_ready' | 'volatility_spike' | 'volume_surge';
  confidence: number;
  timestamp: string;
  marketData: {
    price: number;
    volume24h: number;
    priceChange24h: number;
    marketCap: number;
  };
  indicators: {
    rsi: number;
    macd: number;
    volumeAvg: number;
    volatility: number;
  };
  expectedOutcome: 'positive' | 'negative' | 'neutral';
}

export interface MonitoringMetricsFixture {
  timestamp: string;
  systemHealth: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkLatency: number;
  };
  tradingMetrics: {
    activeTrades: number;
    totalVolume: number;
    successRate: number;
    avgExecutionTime: number;
  };
  apiStatus: {
    mexcApi: 'online' | 'offline' | 'degraded';
    database: 'online' | 'offline' | 'maintenance';
    websocket: 'connected' | 'disconnected' | 'reconnecting';
  };
  alerts: AlertFixture[];
}

export interface AlertFixture {
  id: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
  component: 'trading' | 'api' | 'database' | 'risk' | 'pattern_detection';
  acknowledged: boolean;
  severity: 1 | 2 | 3 | 4 | 5;
}

export interface SettingsFixture {
  apiCredentials: {
    mexcApiKey: string;
    mexcSecretKey: string;
    testConnection: boolean;
  };
  tradingSettings: {
    positionSize: number;
    stopLoss: number;
    takeProfit: number;
    maxConcurrentTrades: number;
    riskManagement: boolean;
    slippage: number;
    orderTimeout: number;
  };
  autoSnipingSettings: {
    enabled: boolean;
    confidenceThreshold: number;
    maxTargetsPerDay: number;
    advanceNoticeMinutes: number;
    patternTypes: string[];
    safetyChecks: boolean;
  };
  riskManagement: {
    maxDailyLoss: number;
    maxPortfolioRisk: number;
    riskPerTrade: number;
    emergencyStopEnabled: boolean;
    correlationLimit: number;
  };
  notifications: {
    emailEnabled: boolean;
    webhookUrl?: string;
    alertTypes: string[];
    quietHours: {
      enabled: boolean;
      start: string;
      end: string;
    };
  };
}

/**
 * User Personas for Different Testing Scenarios
 */
export const USER_PERSONAS: Record<string, UserPersona> = {
  BASIC_TRADER: {
    id: 'basic_trader_001',
    name: 'John Smith',
    email: 'john.smith+test@example.com',
    password: 'SecurePass123!',
    role: 'basic',
    profile: {
      riskTolerance: 'low',
      tradingExperience: 'beginner',
      preferredPatterns: ['ready_state'],
      maxPositionSize: 100,
      dailyTradingLimit: 500
    },
    apiCredentials: {
      mexcApiKey: 'test_basic_api_key_123456',
      mexcSecretKey: 'test_basic_secret_key_789012',
      isValid: true
    },
    settings: {
      theme: 'light',
      notifications: true,
      autoSnipingEnabled: false,
      riskManagementEnabled: true
    }
  },

  EXPERIENCED_TRADER: {
    id: 'experienced_trader_001',
    name: 'Sarah Johnson',
    email: 'sarah.johnson+test@example.com',
    password: 'ExpertPass456!',
    role: 'premium',
    profile: {
      riskTolerance: 'medium',
      tradingExperience: 'expert',
      preferredPatterns: ['ready_state', 'pre_ready', 'volatility_spike'],
      maxPositionSize: 1000,
      dailyTradingLimit: 5000
    },
    apiCredentials: {
      mexcApiKey: 'test_premium_api_key_345678',
      mexcSecretKey: 'test_premium_secret_key_901234',
      isValid: true
    },
    settings: {
      theme: 'dark',
      notifications: true,
      autoSnipingEnabled: true,
      riskManagementEnabled: true
    }
  },

  HIGH_RISK_TRADER: {
    id: 'high_risk_trader_001',
    name: 'Mike Chen',
    email: 'mike.chen+test@example.com',
    password: 'RiskyPass789!',
    role: 'premium',
    profile: {
      riskTolerance: 'high',
      tradingExperience: 'expert',
      preferredPatterns: ['volatility_spike', 'volume_surge', 'ready_state', 'pre_ready'],
      maxPositionSize: 5000,
      dailyTradingLimit: 25000
    },
    apiCredentials: {
      mexcApiKey: 'test_high_risk_api_key_567890',
      mexcSecretKey: 'test_high_risk_secret_key_123456',
      isValid: true
    },
    settings: {
      theme: 'dark',
      notifications: true,
      autoSnipingEnabled: true,
      riskManagementEnabled: false
    }
  },

  ADMIN_USER: {
    id: 'admin_user_001',
    name: 'Admin User',
    email: 'admin+test@example.com',
    password: 'AdminPass123!',
    role: 'admin',
    profile: {
      riskTolerance: 'medium',
      tradingExperience: 'expert',
      preferredPatterns: ['ready_state', 'pre_ready'],
      maxPositionSize: 2000,
      dailyTradingLimit: 10000
    },
    apiCredentials: {
      mexcApiKey: 'test_admin_api_key_789012',
      mexcSecretKey: 'test_admin_secret_key_345678',
      isValid: true
    },
    settings: {
      theme: 'light',
      notifications: true,
      autoSnipingEnabled: true,
      riskManagementEnabled: true
    }
  },

  INVALID_CREDENTIALS_USER: {
    id: 'invalid_user_001',
    name: 'Invalid User',
    email: 'invalid+test@example.com',
    password: 'InvalidPass123!',
    role: 'basic',
    profile: {
      riskTolerance: 'low',
      tradingExperience: 'beginner',
      preferredPatterns: ['ready_state'],
      maxPositionSize: 100,
      dailyTradingLimit: 500
    },
    apiCredentials: {
      mexcApiKey: 'invalid_api_key',
      mexcSecretKey: 'invalid_secret_key',
      isValid: false
    },
    settings: {
      theme: 'light',
      notifications: false,
      autoSnipingEnabled: false,
      riskManagementEnabled: true
    }
  }
};

/**
 * Trading Test Data Fixtures
 */
export const TRADING_FIXTURES: Record<string, TradingFixture[]> = {
  SUCCESSFUL_TRADES: [
    {
      symbol: 'BTCUSDT',
      type: 'market',
      side: 'buy',
      quantity: 0.001,
      expectedResult: 'success'
    },
    {
      symbol: 'ETHUSDT',
      type: 'limit',
      side: 'buy',
      quantity: 0.01,
      price: 2000,
      timeInForce: 'GTC',
      expectedResult: 'success'
    },
    {
      symbol: 'ADAUSDT',
      type: 'market',
      side: 'sell',
      quantity: 100,
      expectedResult: 'success'
    }
  ],

  FAILED_TRADES: [
    {
      symbol: 'INVALID',
      type: 'market',
      side: 'buy',
      quantity: 1,
      expectedResult: 'failure',
      expectedError: 'Invalid symbol'
    },
    {
      symbol: 'BTCUSDT',
      type: 'limit',
      side: 'buy',
      quantity: 999999,
      price: 1,
      expectedResult: 'failure',
      expectedError: 'Insufficient balance'
    },
    {
      symbol: 'ETHUSDT',
      type: 'market',
      side: 'buy',
      quantity: -1,
      expectedResult: 'failure',
      expectedError: 'Invalid quantity'
    }
  ],

  WARNING_TRADES: [
    {
      symbol: 'BTCUSDT',
      type: 'market',
      side: 'buy',
      quantity: 10, // Large quantity might trigger warning
      expectedResult: 'warning'
    },
    {
      symbol: 'ETHUSDT',
      type: 'limit',
      side: 'buy',
      quantity: 1,
      price: 100, // Very low price might trigger warning
      timeInForce: 'IOC',
      expectedResult: 'warning'
    }
  ]
};

/**
 * Pattern Detection Test Data Fixtures
 */
export const PATTERN_FIXTURES: Record<string, PatternDetectionFixture[]> = {
  HIGH_CONFIDENCE_PATTERNS: [
    {
      id: 'pattern_001',
      symbol: 'NEWCOIN',
      patternType: 'ready_state',
      confidence: 95,
      timestamp: '2025-07-04T10:00:00Z',
      marketData: {
        price: 0.001,
        volume24h: 5000000,
        priceChange24h: 150,
        marketCap: 1000000
      },
      indicators: {
        rsi: 75,
        macd: 0.05,
        volumeAvg: 1000000,
        volatility: 25
      },
      expectedOutcome: 'positive'
    },
    {
      id: 'pattern_002',
      symbol: 'MOONCOIN',
      patternType: 'volatility_spike',
      confidence: 88,
      timestamp: '2025-07-04T10:15:00Z',
      marketData: {
        price: 0.005,
        volume24h: 8000000,
        priceChange24h: 200,
        marketCap: 2500000
      },
      indicators: {
        rsi: 82,
        macd: 0.08,
        volumeAvg: 1500000,
        volatility: 45
      },
      expectedOutcome: 'positive'
    }
  ],

  MEDIUM_CONFIDENCE_PATTERNS: [
    {
      id: 'pattern_003',
      symbol: 'TESTCOIN',
      patternType: 'pre_ready',
      confidence: 65,
      timestamp: '2025-07-04T11:00:00Z',
      marketData: {
        price: 0.002,
        volume24h: 2000000,
        priceChange24h: 45,
        marketCap: 800000
      },
      indicators: {
        rsi: 55,
        macd: 0.02,
        volumeAvg: 500000,
        volatility: 15
      },
      expectedOutcome: 'neutral'
    }
  ],

  LOW_CONFIDENCE_PATTERNS: [
    {
      id: 'pattern_004',
      symbol: 'LOWCOIN',
      patternType: 'volume_surge',
      confidence: 35,
      timestamp: '2025-07-04T12:00:00Z',
      marketData: {
        price: 0.0005,
        volume24h: 500000,
        priceChange24h: 10,
        marketCap: 250000
      },
      indicators: {
        rsi: 45,
        macd: -0.01,
        volumeAvg: 200000,
        volatility: 8
      },
      expectedOutcome: 'negative'
    }
  ]
};

/**
 * Monitoring Metrics Test Data Fixtures
 */
export const MONITORING_FIXTURES: Record<string, MonitoringMetricsFixture> = {
  HEALTHY_SYSTEM: {
    timestamp: '2025-07-04T10:00:00Z',
    systemHealth: {
      cpuUsage: 25,
      memoryUsage: 45,
      diskUsage: 30,
      networkLatency: 20
    },
    tradingMetrics: {
      activeTrades: 5,
      totalVolume: 50000,
      successRate: 85,
      avgExecutionTime: 150
    },
    apiStatus: {
      mexcApi: 'online',
      database: 'online',
      websocket: 'connected'
    },
    alerts: []
  },

  WARNING_SYSTEM: {
    timestamp: '2025-07-04T11:00:00Z',
    systemHealth: {
      cpuUsage: 75, // High CPU usage
      memoryUsage: 80, // High memory usage
      diskUsage: 45,
      networkLatency: 150 // High latency
    },
    tradingMetrics: {
      activeTrades: 12,
      totalVolume: 125000,
      successRate: 70, // Lower success rate
      avgExecutionTime: 300 // Slower execution
    },
    apiStatus: {
      mexcApi: 'degraded',
      database: 'online',
      websocket: 'connected'
    },
    alerts: [
      {
        id: 'alert_001',
        type: 'warning',
        message: 'High CPU usage detected',
        timestamp: '2025-07-04T11:00:00Z',
        component: 'trading',
        acknowledged: false,
        severity: 3
      }
    ]
  },

  CRITICAL_SYSTEM: {
    timestamp: '2025-07-04T12:00:00Z',
    systemHealth: {
      cpuUsage: 95, // Critical CPU usage
      memoryUsage: 90, // Critical memory usage
      diskUsage: 85, // High disk usage
      networkLatency: 500 // Very high latency
    },
    tradingMetrics: {
      activeTrades: 0, // No active trades due to issues
      totalVolume: 0,
      successRate: 20, // Very low success rate
      avgExecutionTime: 1000 // Very slow execution
    },
    apiStatus: {
      mexcApi: 'offline',
      database: 'maintenance',
      websocket: 'disconnected'
    },
    alerts: [
      {
        id: 'alert_002',
        type: 'critical',
        message: 'Trading engine offline',
        timestamp: '2025-07-04T12:00:00Z',
        component: 'trading',
        acknowledged: false,
        severity: 5
      },
      {
        id: 'alert_003',
        type: 'error',
        message: 'Database connection lost',
        timestamp: '2025-07-04T12:01:00Z',
        component: 'database',
        acknowledged: false,
        severity: 4
      }
    ]
  }
};

/**
 * Settings Configuration Test Data Fixtures
 */
export const SETTINGS_FIXTURES: Record<string, SettingsFixture> = {
  BASIC_SETTINGS: {
    apiCredentials: {
      mexcApiKey: USER_PERSONAS.BASIC_TRADER.apiCredentials.mexcApiKey,
      mexcSecretKey: USER_PERSONAS.BASIC_TRADER.apiCredentials.mexcSecretKey,
      testConnection: true
    },
    tradingSettings: {
      positionSize: 100,
      stopLoss: 5,
      takeProfit: 15,
      maxConcurrentTrades: 3,
      riskManagement: true,
      slippage: 0.5,
      orderTimeout: 30
    },
    autoSnipingSettings: {
      enabled: false,
      confidenceThreshold: 80,
      maxTargetsPerDay: 5,
      advanceNoticeMinutes: 30,
      patternTypes: ['ready_state'],
      safetyChecks: true
    },
    riskManagement: {
      maxDailyLoss: 500,
      maxPortfolioRisk: 10,
      riskPerTrade: 2,
      emergencyStopEnabled: true,
      correlationLimit: 0.7
    },
    notifications: {
      emailEnabled: true,
      alertTypes: ['trade_executed', 'error_occurred'],
      quietHours: {
        enabled: true,
        start: '22:00',
        end: '08:00'
      }
    }
  },

  AGGRESSIVE_SETTINGS: {
    apiCredentials: {
      mexcApiKey: USER_PERSONAS.HIGH_RISK_TRADER.apiCredentials.mexcApiKey,
      mexcSecretKey: USER_PERSONAS.HIGH_RISK_TRADER.apiCredentials.mexcSecretKey,
      testConnection: true
    },
    tradingSettings: {
      positionSize: 5000,
      stopLoss: 15,
      takeProfit: 50,
      maxConcurrentTrades: 20,
      riskManagement: false,
      slippage: 2.0,
      orderTimeout: 10
    },
    autoSnipingSettings: {
      enabled: true,
      confidenceThreshold: 60,
      maxTargetsPerDay: 50,
      advanceNoticeMinutes: 15,
      patternTypes: ['ready_state', 'pre_ready', 'volatility_spike', 'volume_surge'],
      safetyChecks: false
    },
    riskManagement: {
      maxDailyLoss: 25000,
      maxPortfolioRisk: 50,
      riskPerTrade: 10,
      emergencyStopEnabled: false,
      correlationLimit: 0.9
    },
    notifications: {
      emailEnabled: true,
      webhookUrl: 'https://hooks.example.com/webhook',
      alertTypes: ['trade_executed', 'target_detected', 'error_occurred', 'risk_limit_reached'],
      quietHours: {
        enabled: false,
        start: '00:00',
        end: '00:00'
      }
    }
  },

  INVALID_SETTINGS: {
    apiCredentials: {
      mexcApiKey: 'invalid_key',
      mexcSecretKey: 'invalid_secret',
      testConnection: false
    },
    tradingSettings: {
      positionSize: -100, // Invalid negative value
      stopLoss: -5, // Invalid negative value
      takeProfit: -15, // Invalid negative value
      maxConcurrentTrades: 0, // Invalid zero value
      riskManagement: true,
      slippage: -0.5, // Invalid negative value
      orderTimeout: 0 // Invalid zero timeout
    },
    autoSnipingSettings: {
      enabled: true,
      confidenceThreshold: -10, // Invalid negative value
      maxTargetsPerDay: -5, // Invalid negative value
      advanceNoticeMinutes: -30, // Invalid negative value
      patternTypes: [], // Empty array
      safetyChecks: true
    },
    riskManagement: {
      maxDailyLoss: -500, // Invalid negative value
      maxPortfolioRisk: -10, // Invalid negative value
      riskPerTrade: -2, // Invalid negative value
      emergencyStopEnabled: true,
      correlationLimit: -0.7 // Invalid negative value
    },
    notifications: {
      emailEnabled: true,
      webhookUrl: 'invalid-url', // Invalid URL format
      alertTypes: [], // Empty array
      quietHours: {
        enabled: true,
        start: '25:00', // Invalid time format
        end: '30:00' // Invalid time format
      }
    }
  }
};

/**
 * Market Data Fixtures for Testing
 */
export const MARKET_DATA_FIXTURES = {
  STABLE_MARKET: {
    volatility: 'low',
    priceChangeRange: [-5, 5],
    volumeMultiplier: 1.0,
    trenDirection: 'sideways'
  },

  VOLATILE_MARKET: {
    volatility: 'high',
    priceChangeRange: [-30, 50],
    volumeMultiplier: 3.0,
    trenDirection: 'upward'
  },

  BEAR_MARKET: {
    volatility: 'medium',
    priceChangeRange: [-25, -5],
    volumeMultiplier: 0.7,
    trenDirection: 'downward'
  },

  BULL_MARKET: {
    volatility: 'medium',
    priceChangeRange: [10, 40],
    volumeMultiplier: 2.0,
    trenDirection: 'upward'
  }
};

/**
 * Error Scenarios for Testing
 */
export const ERROR_SCENARIOS = {
  NETWORK_ERRORS: [
    { status: 503, message: 'Service Unavailable' },
    { status: 502, message: 'Bad Gateway' },
    { status: 504, message: 'Gateway Timeout' },
    { status: 429, message: 'Too Many Requests' }
  ],

  API_ERRORS: [
    { status: 401, message: 'Unauthorized - Invalid API credentials' },
    { status: 403, message: 'Forbidden - Insufficient permissions' },
    { status: 400, message: 'Bad Request - Invalid parameters' },
    { status: 422, message: 'Unprocessable Entity - Validation failed' }
  ],

  APPLICATION_ERRORS: [
    { type: 'insufficient_balance', message: 'Insufficient balance for trade' },
    { type: 'invalid_symbol', message: 'Trading pair not supported' },
    { type: 'market_closed', message: 'Market is currently closed' },
    { type: 'rate_limit_exceeded', message: 'Rate limit exceeded, please try again later' }
  ]
};

/**
 * Performance Test Data
 */
export const PERFORMANCE_FIXTURES = {
  LOAD_TEST_SCENARIOS: [
    { name: 'Light Load', concurrent_users: 10, duration: '5m' },
    { name: 'Normal Load', concurrent_users: 50, duration: '10m' },
    { name: 'Heavy Load', concurrent_users: 100, duration: '15m' },
    { name: 'Stress Test', concurrent_users: 200, duration: '20m' }
  ],

  PERFORMANCE_THRESHOLDS: {
    page_load_time: 3000, // 3 seconds
    api_response_time: 500, // 500ms
    database_query_time: 100, // 100ms
    websocket_connection_time: 1000 // 1 second
  }
};

/**
 * Accessibility Test Data
 */
export const ACCESSIBILITY_FIXTURES = {
  KEYBOARD_NAVIGATION: [
    'Tab', 'Shift+Tab', 'Enter', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'
  ],

  SCREEN_READER_LANDMARKS: [
    'banner', 'navigation', 'main', 'complementary', 'contentinfo', 'search', 'form'
  ],

  COLOR_CONTRAST_REQUIREMENTS: {
    normal_text: 4.5,
    large_text: 3.0,
    non_text: 3.0
  }
};

/**
 * Utility function to get persona by type
 */
export function getUserPersona(type: keyof typeof USER_PERSONAS): UserPersona {
  return USER_PERSONAS[type];
}

/**
 * Utility function to get random trading fixture
 */
export function getRandomTradingFixture(category: keyof typeof TRADING_FIXTURES): TradingFixture {
  const fixtures = TRADING_FIXTURES[category];
  return fixtures[Math.floor(Math.random() * fixtures.length)];
}

/**
 * Utility function to get pattern fixture by confidence level
 */
export function getPatternFixture(confidenceLevel: keyof typeof PATTERN_FIXTURES): PatternDetectionFixture[] {
  return PATTERN_FIXTURES[confidenceLevel];
}

/**
 * Utility function to get monitoring fixture by system state
 */
export function getMonitoringFixture(systemState: keyof typeof MONITORING_FIXTURES): MonitoringMetricsFixture {
  return MONITORING_FIXTURES[systemState];
}

/**
 * Utility function to get settings fixture by risk level
 */
export function getSettingsFixture(riskLevel: keyof typeof SETTINGS_FIXTURES): SettingsFixture {
  return SETTINGS_FIXTURES[riskLevel];
}