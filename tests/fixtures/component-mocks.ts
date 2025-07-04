/**
 * Component Mock Data Factories
 * Provides consistent mock data for all component tests
 */

import { vi } from 'vitest';

// User and Authentication Mocks
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  emailVerified: true,
  role: 'user',
};

export const mockSession = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_at: Date.now() + 3600000,
  token_type: 'bearer',
  user: mockUser,
};

export const mockAuthContext = {
  user: mockUser,
  session: mockSession,
  isLoading: false,
  error: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  resetPassword: vi.fn(),
};

// API Credentials Mocks
export const mockApiCredentials = {
  id: 'test-creds-123',
  userId: 'test-user-id',
  mexcApiKey: 'encrypted_test-api-key',
  mexcSecretKey: 'encrypted_test-secret-key',
  isActive: true,
  isValid: true,
  validatedAt: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  permissions: ['spot', 'futures'],
};

// Trading Data Mocks
export const mockTradingData = {
  symbol: 'BTCUSDT',
  price: '45000.00',
  quantity: '0.001',
  side: 'BUY',
  type: 'MARKET',
  status: 'FILLED',
  orderId: 'order-123',
  timestamp: new Date('2024-01-01'),
  commission: '0.001',
  commissionAsset: 'BTC',
};

export const mockBalance = {
  asset: 'USDT',
  free: '1000.00',
  locked: '0.00',
  total: '1000.00',
  availableForTrade: '1000.00',
  usdValue: '1000.00',
};

export const mockPortfolio = {
  totalValue: '10000.00',
  totalPnl: '500.00',
  totalPnlPercent: '5.00',
  balances: [mockBalance],
  positions: [],
  performance: {
    daily: '1.5',
    weekly: '5.2',
    monthly: '12.8',
    yearly: '45.3',
  },
};

// Pattern Detection Mocks
export const mockPattern = {
  id: 'pattern-123',
  symbol: 'BTCUSDT',
  patternType: 'BULLISH_BREAKOUT',
  confidence: 0.85,
  timestamp: new Date('2024-01-01'),
  indicators: {
    rsi: 65,
    macd: 0.02,
    volume: 1000000,
    sma20: 44000,
    sma50: 43000,
    bollinger: {
      upper: 46000,
      middle: 45000,
      lower: 44000,
    },
  },
  signals: [
    {
      type: 'VOLUME_SURGE',
      strength: 0.8,
      timestamp: new Date('2024-01-01'),
    },
    {
      type: 'RSI_OVERSOLD',
      strength: 0.7,
      timestamp: new Date('2024-01-01'),
    },
  ],
};

// Auto-Sniping Mocks
export const mockSnipingConfig = {
  id: 'config-123',
  userId: 'test-user-id',
  isActive: true,
  symbol: 'BTCUSDT',
  buyAmount: '100.00',
  maxPrice: '50000.00',
  minConfidence: 0.75,
  stopLoss: '5.00',
  takeProfit: '10.00',
  maxSlippage: '2.00',
  patternTypes: ['BULLISH_BREAKOUT', 'VOLUME_SURGE'],
  timeframe: '1h',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockSnipingExecution = {
  id: 'execution-123',
  configId: 'config-123',
  patternId: 'pattern-123',
  symbol: 'BTCUSDT',
  status: 'COMPLETED',
  buyOrder: {
    orderId: 'buy-order-123',
    price: '45000.00',
    quantity: '0.002',
    status: 'FILLED',
    timestamp: new Date('2024-01-01'),
  },
  sellOrder: {
    orderId: 'sell-order-123',
    price: '49500.00',
    quantity: '0.002',
    status: 'FILLED',
    timestamp: new Date('2024-01-01'),
  },
  pnl: '9.00',
  pnlPercent: '10.00',
  executedAt: new Date('2024-01-01'),
  completedAt: new Date('2024-01-01'),
};

// Dashboard Metrics Mocks
export const mockMetrics = {
  totalTrades: 150,
  successfulTrades: 120,
  successRate: '80.00',
  totalPnl: '2500.00',
  totalPnlPercent: '25.00',
  averagePnl: '16.67',
  bestTrade: '150.00',
  worstTrade: '-45.00',
  averageHoldTime: '2.5h',
  winRate: '78.00',
  riskRewardRatio: '2.1',
  sharpeRatio: '1.85',
  maxDrawdown: '8.50',
  currentStreak: 5,
  longestWinStreak: 12,
  longestLossStreak: 3,
};

// Alert System Mocks
export const mockAlert = {
  id: 'alert-123',
  userId: 'test-user-id',
  type: 'PATTERN_DETECTED',
  priority: 'HIGH',
  title: 'Bullish Breakout Detected',
  message: 'BTCUSDT showing strong bullish breakout pattern with 85% confidence',
  symbol: 'BTCUSDT',
  patternId: 'pattern-123',
  read: false,
  dismissed: false,
  actionRequired: true,
  createdAt: new Date('2024-01-01'),
  metadata: {
    confidence: 0.85,
    patternType: 'BULLISH_BREAKOUT',
    indicators: ['RSI_OVERSOLD', 'VOLUME_SURGE'],
  },
};

// System Health Mocks
export const mockSystemHealth = {
  overall: 'HEALTHY',
  services: {
    database: {
      status: 'HEALTHY',
      responseTime: 15,
      lastCheck: new Date('2024-01-01'),
    },
    mexcApi: {
      status: 'HEALTHY',
      responseTime: 120,
      lastCheck: new Date('2024-01-01'),
    },
    websocket: {
      status: 'HEALTHY',
      connectionCount: 5,
      lastCheck: new Date('2024-01-01'),
    },
    aiServices: {
      status: 'HEALTHY',
      responseTime: 300,
      lastCheck: new Date('2024-01-01'),
    },
  },
  performance: {
    cpuUsage: '25.5',
    memoryUsage: '45.2',
    diskUsage: '12.8',
    networkLatency: '50ms',
  },
};

// Error Mocks
export const mockError = {
  name: 'TestError',
  message: 'This is a test error',
  code: 'TEST_ERROR',
  stack: 'Error: This is a test error\n    at test.js:1:1',
  timestamp: new Date('2024-01-01'),
};

export const mockApiError = {
  error: 'API_ERROR',
  message: 'API request failed',
  code: 400,
  details: {
    endpoint: '/api/test',
    method: 'POST',
    timestamp: new Date('2024-01-01'),
  },
};

// WebSocket Mocks
export const mockWebSocketData = {
  symbol: 'BTCUSDT',
  price: '45000.00',
  change: '500.00',
  changePercent: '1.12',
  volume: '1000000',
  high: '45500.00',
  low: '44000.00',
  timestamp: new Date('2024-01-01'),
};

// Component Props Mocks
export const mockComponentProps = {
  // Button props
  button: {
    onClick: vi.fn(),
    disabled: false,
    loading: false,
    variant: 'primary',
    size: 'medium',
  },
  
  // Form props
  form: {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    loading: false,
    errors: {},
    values: {},
  },
  
  // Modal props
  modal: {
    open: true,
    onClose: vi.fn(),
    title: 'Test Modal',
    size: 'medium',
  },
  
  // Table props
  table: {
    data: [],
    columns: [],
    loading: false,
    onRowClick: vi.fn(),
    onSort: vi.fn(),
    sortBy: '',
    sortOrder: 'asc',
  },
  
  // Chart props
  chart: {
    data: [],
    type: 'line',
    width: 400,
    height: 300,
    responsive: true,
  },
};

// Mock React Query responses
export const mockQueryResponse = {
  data: null,
  error: null,
  isLoading: false,
  isError: false,
  isSuccess: true,
  isFetching: false,
  refetch: vi.fn(),
  remove: vi.fn(),
};

// Mock hooks
export const mockHooks = {
  useApiCredentials: () => ({
    credentials: mockApiCredentials,
    isLoading: false,
    error: null,
    validate: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  }),
  
  useBalance: () => ({
    balance: mockBalance,
    portfolio: mockPortfolio,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  }),
  
  usePatterns: () => ({
    patterns: [mockPattern],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  
  useSnipingConfig: () => ({
    config: mockSnipingConfig,
    executions: [mockSnipingExecution],
    isLoading: false,
    error: null,
    save: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }),
  
  useAlerts: () => ({
    alerts: [mockAlert],
    unreadCount: 1,
    isLoading: false,
    error: null,
    markAsRead: vi.fn(),
    dismiss: vi.fn(),
  }),
  
  useSystemHealth: () => ({
    health: mockSystemHealth,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  }),
};

// Export all mocks as a single object for easy importing
export const componentMocks = {
  user: mockUser,
  session: mockSession,
  authContext: mockAuthContext,
  apiCredentials: mockApiCredentials,
  tradingData: mockTradingData,
  balance: mockBalance,
  portfolio: mockPortfolio,
  pattern: mockPattern,
  snipingConfig: mockSnipingConfig,
  snipingExecution: mockSnipingExecution,
  metrics: mockMetrics,
  alert: mockAlert,
  systemHealth: mockSystemHealth,
  error: mockError,
  apiError: mockApiError,
  webSocketData: mockWebSocketData,
  componentProps: mockComponentProps,
  queryResponse: mockQueryResponse,
  hooks: mockHooks,
};

export default componentMocks;