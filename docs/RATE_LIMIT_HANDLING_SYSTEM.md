# Rate Limit Handling System Documentation

## Overview

The MEXC Sniper Bot implements a comprehensive rate limit handling system to manage Supabase's strict email authentication limits while providing an excellent user experience. This document covers the system architecture, user experience improvements, and implementation details.

## Supabase Rate Limits

### Current Limits (as of 2024)
- **Email Signup/Recovery**: 2 emails per hour per project
- **Email Verification**: Limited verification requests
- **OTP Endpoints**: 360 requests per hour
- **Token Refresh**: 1800 requests per hour
- **MFA Challenges**: 15 requests per minute
- **Anonymous Sign-ins**: 30 requests per hour

### Impact on User Experience
- Users may be blocked from creating accounts
- Password reset emails may not be sent
- Development and testing severely impacted
- Production applications can become unusable during peak usage

## Rate Limit Handling Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Rate Limit Handling System              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Rate Limit     │  │   User          │  │   Recovery      │  │
│  │  Detection      │  │   Experience    │  │   Mechanisms    │  │
│  │                 │  │                 │  │                 │  │
│  │ • Error         │  │ • Notifications │  │ • Email Bypass  │  │
│  │   Monitoring    │  │ • Retry Logic   │  │ • Custom SMTP   │  │
│  │ • Response      │  │ • Progress      │  │ • Queue System  │  │
│  │   Analysis      │  │   Indicators    │  │ • Fallbacks     │  │
│  │ • Pattern       │  │ • Help Options  │  │                 │  │
│  │   Recognition   │  │                 │  │                 │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Core Implementation Files

#### 1. Rate Limit Detection
**File**: `src/lib/supabase-rate-limit-handler.ts`
```typescript
export class RateLimitHandler {
  private rateLimitState = {
    isRateLimited: false,
    resetTime: null,
    retryAfter: 0,
    errorCount: 0,
  }

  detectRateLimit(error: any): boolean {
    const rateLimitIndicators = [
      'rate limit',
      'too many requests',
      'quota exceeded',
      'limit exceeded',
      '429',
    ]

    const errorMessage = error.message?.toLowerCase() || ''
    return rateLimitIndicators.some(indicator => 
      errorMessage.includes(indicator)
    )
  }

  extractRetryAfter(error: any): number {
    // Extract retry-after from headers or error message
    const retryAfter = error.headers?.['retry-after'] || 
                      error.retryAfter || 
                      3600 // Default to 1 hour

    return typeof retryAfter === 'string' 
      ? parseInt(retryAfter) 
      : retryAfter
  }

  calculateResetTime(retryAfter: number): Date {
    return new Date(Date.now() + (retryAfter * 1000))
  }
}
```

#### 2. User Experience Components
**File**: `src/components/auth/rate-limit-notice.tsx`
```typescript
interface RateLimitNoticeProps {
  isVisible: boolean
  resetTime: Date | null
  onRetry?: () => void
  onBypass?: () => void
  showBypass?: boolean
}

export function RateLimitNotice({
  isVisible,
  resetTime,
  onRetry,
  onBypass,
  showBypass = false
}: RateLimitNoticeProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0)

  useEffect(() => {
    if (!resetTime) return

    const interval = setInterval(() => {
      const remaining = Math.max(0, resetTime.getTime() - Date.now())
      setTimeRemaining(remaining)

      if (remaining === 0) {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [resetTime])

  if (!isVisible) return null

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="rate-limit-notice">
      <div className="rate-limit-header">
        <AlertTriangleIcon className="rate-limit-icon" />
        <h3>Rate Limit Reached</h3>
      </div>
      
      <div className="rate-limit-content">
        <p>
          We've reached the email sending limit. This is a temporary restriction
          to prevent spam and ensure system stability.
        </p>
        
        {timeRemaining > 0 && (
          <div className="rate-limit-timer">
            <p>Time until reset: <strong>{formatTime(timeRemaining)}</strong></p>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{
                  width: `${(timeRemaining / 3600000) * 100}%`
                }}
              />
            </div>
          </div>
        )}
        
        <div className="rate-limit-actions">
          {timeRemaining === 0 && (
            <button onClick={onRetry} className="retry-button">
              Try Again
            </button>
          )}
          
          {showBypass && onBypass && (
            <button onClick={onBypass} className="bypass-button">
              Bypass (Development Only)
            </button>
          )}
        </div>
        
        <div className="rate-limit-help">
          <h4>What can you do?</h4>
          <ul>
            <li>Wait for the rate limit to reset</li>
            <li>Try using a different email address</li>
            <li>Contact support if this persists</li>
            {showBypass && (
              <li>Use development bypass (testing only)</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
```

#### 3. Enhanced Auth Provider
**File**: `src/components/auth/supabase-auth-provider-enhanced.tsx`
```typescript
export function SupabaseAuthProvider({ children }: SupabaseAuthProviderProps) {
  const [rateLimitState, setRateLimitState] = useState({
    isRateLimited: false,
    resetTime: null,
    lastError: null,
  })

  const rateLimitHandler = new RateLimitHandler()

  const handleAuthError = useCallback((error: any, operation: string) => {
    if (rateLimitHandler.detectRateLimit(error)) {
      const retryAfter = rateLimitHandler.extractRetryAfter(error)
      const resetTime = rateLimitHandler.calculateResetTime(retryAfter)

      setRateLimitState({
        isRateLimited: true,
        resetTime,
        lastError: error,
      })

      // Log rate limit event
      console.warn(`Rate limit hit during ${operation}:`, {
        error: error.message,
        retryAfter,
        resetTime,
      })

      return true
    }

    return false
  }, [rateLimitHandler])

  const signInWithRetry = useCallback(async (
    email: string, 
    password: string,
    retryCount = 0
  ) => {
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        const wasRateLimit = handleAuthError(error, 'signIn')
        if (!wasRateLimit && retryCount < 3) {
          // Exponential backoff for other errors
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, retryCount) * 1000)
          )
          return signInWithRetry(email, password, retryCount + 1)
        }
        throw error
      }

      // Clear rate limit state on success
      setRateLimitState(prev => ({ ...prev, isRateLimited: false }))
      return { error: null }
    } catch (error) {
      return { error }
    }
  }, [handleAuthError])

  // Similar implementation for signUp, resetPassword, etc.

  return (
    <SupabaseAuthContext.Provider value={{
      // ... existing context values
      rateLimitState,
      signInWithRetry,
      // ... other enhanced methods
    }}>
      {children}
      <RateLimitNotice
        isVisible={rateLimitState.isRateLimited}
        resetTime={rateLimitState.resetTime}
        onRetry={() => setRateLimitState(prev => ({ 
          ...prev, 
          isRateLimited: false 
        }))}
        onBypass={() => {
          if (process.env.NODE_ENV === 'development') {
            // Trigger bypass mechanism
            handleBypass()
          }
        }}
        showBypass={process.env.NODE_ENV === 'development'}
      />
    </SupabaseAuthContext.Provider>
  )
}
```

## User Experience Improvements

### 1. Proactive Rate Limit Prevention

#### Request Throttling
```typescript
// lib/auth-throttler.ts
export class AuthThrottler {
  private requestQueue: Map<string, number[]> = new Map()
  private readonly windowMs = 3600000 // 1 hour
  private readonly maxRequests = 2 // Supabase limit

  canMakeRequest(operation: string, email: string): boolean {
    const key = `${operation}:${email}`
    const now = Date.now()
    const requests = this.requestQueue.get(key) || []

    // Remove requests outside the window
    const validRequests = requests.filter(time => 
      now - time < this.windowMs
    )

    if (validRequests.length >= this.maxRequests) {
      return false
    }

    // Add current request
    validRequests.push(now)
    this.requestQueue.set(key, validRequests)
    return true
  }

  getNextAvailableTime(operation: string, email: string): Date | null {
    const key = `${operation}:${email}`
    const requests = this.requestQueue.get(key) || []
    
    if (requests.length < this.maxRequests) {
      return null // Can make request now
    }

    const oldestRequest = Math.min(...requests)
    return new Date(oldestRequest + this.windowMs)
  }
}
```

#### Pre-request Validation
```typescript
// Hook for checking rate limits before requests
export function useRateLimitCheck() {
  const throttler = useMemo(() => new AuthThrottler(), [])

  const checkRateLimit = useCallback((
    operation: string, 
    email: string
  ): { canProceed: boolean; nextAvailable?: Date } => {
    const canProceed = throttler.canMakeRequest(operation, email)
    
    if (!canProceed) {
      const nextAvailable = throttler.getNextAvailableTime(operation, email)
      return { canProceed: false, nextAvailable }
    }

    return { canProceed: true }
  }, [throttler])

  return { checkRateLimit }
}
```

### 2. Smart Retry Logic

#### Exponential Backoff with Jitter
```typescript
// lib/retry-logic.ts
export class SmartRetry {
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number
      baseDelay?: number
      maxDelay?: number
      jitter?: boolean
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      jitter = true
    } = options

    let lastError: any

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error

        // Don't retry rate limit errors
        if (this.isRateLimit(error)) {
          throw error
        }

        if (attempt === maxRetries) {
          throw lastError
        }

        // Calculate delay with exponential backoff
        let delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
        
        // Add jitter to prevent thundering herd
        if (jitter) {
          delay = delay * (0.5 + Math.random() * 0.5)
        }

        await this.sleep(delay)
      }
    }

    throw lastError
  }

  private isRateLimit(error: any): boolean {
    const message = error.message?.toLowerCase() || ''
    return message.includes('rate limit') || 
           message.includes('too many requests')
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
```

### 3. User Feedback and Communication

#### Progress Indicators
```typescript
// components/auth/auth-progress.tsx
export function AuthProgress({ 
  stage, 
  isLoading, 
  error,
  onRetry 
}: AuthProgressProps) {
  const stages = [
    { id: 'validate', label: 'Validating credentials' },
    { id: 'submit', label: 'Submitting request' },
    { id: 'confirm', label: 'Confirming email' },
    { id: 'complete', label: 'Completing setup' },
  ]

  return (
    <div className="auth-progress">
      <div className="progress-steps">
        {stages.map((step, index) => (
          <div 
            key={step.id}
            className={`progress-step ${
              index <= stages.findIndex(s => s.id === stage) 
                ? 'completed' 
                : 'pending'
            }`}
          >
            <div className="step-indicator">
              {index < stages.findIndex(s => s.id === stage) && (
                <CheckIcon className="step-icon" />
              )}
              {index === stages.findIndex(s => s.id === stage) && isLoading && (
                <LoadingSpinner className="step-icon" />
              )}
              {index === stages.findIndex(s => s.id === stage) && error && (
                <AlertIcon className="step-icon error" />
              )}
            </div>
            <span className="step-label">{step.label}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="error-message">
          <p>{error.message}</p>
          {onRetry && (
            <button onClick={onRetry} className="retry-button">
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

#### Smart Error Messages
```typescript
// lib/error-messages.ts
export const getErrorMessage = (error: any): string => {
  const message = error.message?.toLowerCase() || ''

  if (message.includes('rate limit')) {
    return "We've temporarily hit our email sending limit. Please wait a moment and try again, or contact support if this persists."
  }

  if (message.includes('email')) {
    return "There was an issue with email verification. Please check your email or try a different address."
  }

  if (message.includes('network')) {
    return "Connection issue detected. Please check your internet connection and try again."
  }

  if (message.includes('invalid')) {
    return "Please check your credentials and try again."
  }

  return "An unexpected error occurred. Please try again or contact support if the issue persists."
}

export const getErrorSuggestions = (error: any): string[] => {
  const message = error.message?.toLowerCase() || ''

  if (message.includes('rate limit')) {
    return [
      'Wait 1 hour for the limit to reset',
      'Try using a different email address',
      'Contact support for assistance',
    ]
  }

  if (message.includes('email')) {
    return [
      'Check your spam/junk folder',
      'Verify the email address is correct',
      'Try using a different email provider',
    ]
  }

  return [
    'Refresh the page and try again',
    'Check your internet connection',
    'Contact support if the issue persists',
  ]
}
```

## Recovery Mechanisms

### 1. Email Bypass System (Development)

#### Bypass API Implementation
```typescript
// app/api/admin/bypass-email-confirmation/route.ts
export async function POST(request: NextRequest) {
  // Environment check
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Bypass not available in production' },
      { status: 403 }
    )
  }

  try {
    const { email } = await request.json()

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    const supabase = await createSupabaseServerClient()
    
    // Get user by email
    const { data: user, error: getUserError } = await supabase.auth.admin
      .listUsers()
      .then(response => ({
        data: response.data.users.find(u => u.email === email),
        error: response.error
      }))

    if (getUserError) {
      throw getUserError
    }

    if (!user) {
      return NextResponse.json(
        { error: `User not found with email: ${email}` },
        { status: 404 }
      )
    }

    // Confirm user email
    const { error: confirmError } = await supabase.auth.admin
      .updateUserById(user.id, {
        email_confirm: true
      })

    if (confirmError) {
      throw confirmError
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `Successfully bypassed email confirmation for: ${email}`,
        user: {
          id: user.id,
          email: user.email,
          emailConfirmed: true,
          emailConfirmedAt: new Date().toISOString(),
        },
        bypassed: true,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Email bypass error:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to bypass email confirmation',
    }, { status: 500 })
  }
}
```

### 2. Custom SMTP Integration

#### SMTP Fallback System
```typescript
// lib/smtp-fallback.ts
export class SMTPFallback {
  private providers = [
    {
      name: 'resend',
      config: {
        host: 'smtp.resend.com',
        port: 587,
        user: process.env.RESEND_API_KEY,
      }
    },
    {
      name: 'sendgrid',
      config: {
        host: 'smtp.sendgrid.net',
        port: 587,
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      }
    }
  ]

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    for (const provider of this.providers) {
      try {
        await this.sendWithProvider(provider, to, subject, html)
        console.log(`Email sent successfully via ${provider.name}`)
        return true
      } catch (error) {
        console.warn(`Failed to send via ${provider.name}:`, error)
        continue
      }
    }

    console.error('All SMTP providers failed')
    return false
  }

  private async sendWithProvider(
    provider: any,
    to: string,
    subject: string,
    html: string
  ): Promise<void> {
    // Implementation depends on provider
    // This is a simplified example
    const transporter = nodemailer.createTransporter(provider.config)
    
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html,
    })
  }
}
```

### 3. Queue-Based Email System

#### Email Queue Implementation
```typescript
// lib/email-queue.ts
export class EmailQueue {
  private queue: EmailJob[] = []
  private isProcessing = false

  addToQueue(job: EmailJob): void {
    this.queue.push({
      ...job,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      attempts: 0,
      status: 'pending',
    })

    this.processQueue()
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return
    }

    this.isProcessing = true

    while (this.queue.length > 0) {
      const job = this.queue.shift()!
      
      try {
        await this.processJob(job)
        job.status = 'completed'
      } catch (error) {
        job.attempts++
        job.lastError = error

        if (job.attempts < 3) {
          // Retry with exponential backoff
          const delay = Math.pow(2, job.attempts) * 1000
          setTimeout(() => {
            this.queue.unshift(job) // Add back to front
            this.processQueue()
          }, delay)
        } else {
          job.status = 'failed'
          console.error(`Email job failed after ${job.attempts} attempts:`, error)
        }
      }
    }

    this.isProcessing = false
  }

  private async processJob(job: EmailJob): Promise<void> {
    // Check rate limits
    const rateLimitCheck = this.checkRateLimit(job.type)
    if (!rateLimitCheck.canSend) {
      // Schedule for later
      const delay = rateLimitCheck.retryAfter
      setTimeout(() => {
        this.queue.unshift(job)
        this.processQueue()
      }, delay)
      return
    }

    // Send email
    await this.sendEmail(job)
  }
}
```

## Monitoring and Analytics

### 1. Rate Limit Metrics

#### Metrics Collection
```typescript
// lib/rate-limit-metrics.ts
export class RateLimitMetrics {
  private metrics = {
    rateLimitHits: 0,
    successfulRequests: 0,
    failedRequests: 0,
    bypassUsage: 0,
    averageWaitTime: 0,
  }

  recordRateLimit(operation: string, resetTime: Date): void {
    this.metrics.rateLimitHits++
    
    // Log to analytics service
    this.logEvent('rate_limit_hit', {
      operation,
      resetTime: resetTime.toISOString(),
      timestamp: new Date().toISOString(),
    })
  }

  recordSuccess(operation: string, duration: number): void {
    this.metrics.successfulRequests++
    
    this.logEvent('auth_success', {
      operation,
      duration,
      timestamp: new Date().toISOString(),
    })
  }

  recordBypass(email: string): void {
    this.metrics.bypassUsage++
    
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      this.logEvent('email_bypass_used', {
        email: this.hashEmail(email),
        timestamp: new Date().toISOString(),
      })
    }
  }

  getMetrics(): object {
    return { ...this.metrics }
  }

  private logEvent(event: string, data: object): void {
    // Send to analytics service (e.g., PostHog, Mixpanel)
    console.log(`Analytics: ${event}`, data)
  }

  private hashEmail(email: string): string {
    // Simple hash for privacy
    return btoa(email).slice(0, 8)
  }
}
```

### 2. Health Monitoring

#### Rate Limit Health Check
```typescript
// app/api/health/rate-limits/route.ts
export async function GET() {
  const metrics = rateLimitMetrics.getMetrics()
  const currentStatus = await checkCurrentRateLimitStatus()
  
  return NextResponse.json({
    status: currentStatus.isHealthy ? 'healthy' : 'degraded',
    rateLimits: {
      current: currentStatus,
      metrics,
      recommendations: generateRecommendations(metrics),
    },
    timestamp: new Date().toISOString(),
  })
}

async function checkCurrentRateLimitStatus() {
  // Check if we can make auth requests
  try {
    const testResult = await simulateAuthRequest()
    return {
      isHealthy: true,
      canMakeRequests: true,
      nextReset: null,
    }
  } catch (error) {
    if (isRateLimitError(error)) {
      return {
        isHealthy: false,
        canMakeRequests: false,
        nextReset: extractResetTime(error),
        error: error.message,
      }
    }
    
    throw error
  }
}
```

## Best Practices

### 1. Development Practices

#### Environment-Aware Code
```typescript
// Always check environment before using bypass
const isDevelopment = process.env.NODE_ENV === 'development'
const isTestEnvironment = process.env.NODE_ENV === 'test'

if (isDevelopment || isTestEnvironment) {
  // Safe to use bypass mechanisms
  await bypassEmailConfirmation(email)
} else {
  // Production - use proper flow
  await sendConfirmationEmail(email)
}
```

#### Graceful Degradation
```typescript
// Provide alternative flows when rate limited
const handleAuthFlow = async (email: string, password: string) => {
  try {
    return await normalAuthFlow(email, password)
  } catch (error) {
    if (isRateLimit(error)) {
      // Offer alternative approaches
      return await handleRateLimitedAuth(email, password)
    }
    throw error
  }
}
```

### 2. Production Considerations

#### Custom SMTP Setup
- Configure reliable SMTP provider (Resend, SendGrid, SES)
- Set up proper DNS records (SPF, DKIM, DMARC)
- Monitor email delivery rates
- Implement fallback providers

#### Monitoring Setup
- Track rate limit occurrences
- Monitor user impact
- Set up alerts for rate limit breaches
- Analyze patterns to predict issues

### 3. User Communication

#### Clear Messaging
```typescript
const rateLimitMessages = {
  title: "We're experiencing high demand",
  message: "We've temporarily hit our email sending limit to ensure system stability.",
  actions: [
    "Wait for the limit to reset",
    "Try using a different email address",
    "Contact support for assistance"
  ],
  timeframe: "Rate limits typically reset within 1 hour"
}
```

#### Help and Support
- Provide clear documentation
- Offer alternative contact methods
- Implement chat support for critical issues
- Create FAQ for common scenarios

## Future Improvements

### 1. Advanced Features

#### Predictive Rate Limiting
- ML-based usage prediction
- Proactive user communication
- Dynamic request routing
- Intelligent queue management

#### Enhanced User Experience
- Real-time status updates
- Progressive enhancement
- Offline functionality
- Mobile-optimized flows

### 2. Technical Enhancements

#### Distributed Rate Limiting
- Redis-based rate limiting
- Multi-region coordination
- Shared rate limit pools
- Edge-based processing

#### Advanced Recovery
- AI-powered error recovery
- Context-aware retries
- User preference learning
- Adaptive timeout strategies

## Conclusion

The rate limit handling system provides a comprehensive solution for managing Supabase's email authentication limitations while maintaining excellent user experience. Key benefits include:

- **Proactive Prevention**: Throttling and validation prevent rate limit hits
- **Graceful Handling**: Smart detection and user-friendly responses
- **Development Productivity**: Bypass mechanisms for efficient testing
- **Production Reliability**: Custom SMTP and fallback systems
- **Comprehensive Monitoring**: Metrics and health checks for optimization

The system is designed to be maintainable, scalable, and user-focused, ensuring that authentication remains reliable even under challenging rate limit constraints.