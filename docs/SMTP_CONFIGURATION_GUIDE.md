# SMTP Configuration Guide for Supabase Authentication

## Overview

This guide provides comprehensive instructions for configuring custom SMTP providers with Supabase authentication to bypass the restrictive 2 emails per hour rate limit. Custom SMTP configuration is essential for production deployments and high-volume testing.

## Why Custom SMTP is Necessary

### Supabase Email Limitations
- **Email Signup/Recovery**: 2 emails per hour (extremely restrictive)
- **Email Verification**: Limited verification requests
- **Production Impact**: Rate limits can block legitimate users
- **Development Impact**: Slows down testing and development

### Benefits of Custom SMTP
- **Unlimited Emails**: No rate limit restrictions
- **Better Deliverability**: Professional email providers
- **Custom Branding**: Personalized email templates
- **Reliability**: Dedicated email infrastructure
- **Analytics**: Email delivery tracking and analytics

## Recommended SMTP Providers

### 1. Resend (Recommended)
**Best for**: Modern applications, excellent deliverability, developer-friendly

```bash
# Environment Variables
SUPABASE_SMTP_HOST=smtp.resend.com
SUPABASE_SMTP_PORT=587
SUPABASE_SMTP_USER=resend
SUPABASE_SMTP_PASS=re_your-api-key
SUPABASE_SMTP_FROM=noreply@yourdomain.com
```

**Setup Steps:**
1. Sign up at https://resend.com
2. Verify your domain
3. Generate API key
4. Add environment variables
5. Configure Supabase dashboard

**Pricing**: Free tier includes 3,000 emails/month

### 2. SendGrid
**Best for**: Enterprise applications, detailed analytics

```bash
# Environment Variables
SUPABASE_SMTP_HOST=smtp.sendgrid.net
SUPABASE_SMTP_PORT=587
SUPABASE_SMTP_USER=apikey
SUPABASE_SMTP_PASS=your-sendgrid-api-key
SUPABASE_SMTP_FROM=noreply@yourdomain.com
```

**Setup Steps:**
1. Sign up at https://sendgrid.com
2. Create API key with mail sending permissions
3. Verify domain/single sender
4. Add environment variables
5. Configure Supabase dashboard

**Pricing**: Free tier includes 100 emails/day

### 3. Amazon SES
**Best for**: AWS ecosystem, cost-effective for high volume

```bash
# Environment Variables
SUPABASE_SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SUPABASE_SMTP_PORT=587
SUPABASE_SMTP_USER=your-ses-smtp-username
SUPABASE_SMTP_PASS=your-ses-smtp-password
SUPABASE_SMTP_FROM=noreply@yourdomain.com
```

**Setup Steps:**
1. Set up AWS SES in AWS Console
2. Verify your domain
3. Create SMTP credentials
4. Move out of sandbox mode
5. Add environment variables

**Pricing**: $0.10 per 1,000 emails

### 4. Mailgun
**Best for**: Developers, robust API, good deliverability

```bash
# Environment Variables
SUPABASE_SMTP_HOST=smtp.mailgun.org
SUPABASE_SMTP_PORT=587
SUPABASE_SMTP_USER=postmaster@your-domain.mailgun.org
SUPABASE_SMTP_PASS=your-mailgun-password
SUPABASE_SMTP_FROM=noreply@yourdomain.com
```

**Setup Steps:**
1. Sign up at https://mailgun.com
2. Add your domain
3. Verify domain with DNS records
4. Get SMTP credentials
5. Add environment variables

**Pricing**: Free tier includes 5,000 emails/month

### 5. Postmark
**Best for**: Transactional emails, excellent deliverability

```bash
# Environment Variables
SUPABASE_SMTP_HOST=smtp.postmarkapp.com
SUPABASE_SMTP_PORT=587
SUPABASE_SMTP_USER=your-postmark-server-token
SUPABASE_SMTP_PASS=your-postmark-server-token
SUPABASE_SMTP_FROM=noreply@yourdomain.com
```

**Setup Steps:**
1. Sign up at https://postmarkapp.com
2. Create server
3. Add verified sender domain
4. Get server token
5. Add environment variables

**Pricing**: Free tier includes 100 emails/month

## Environment Configuration

### Complete Environment Variables
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Custom SMTP Configuration
SUPABASE_SMTP_HOST=smtp.resend.com
SUPABASE_SMTP_PORT=587
SUPABASE_SMTP_USER=resend
SUPABASE_SMTP_PASS=re_your-api-key
SUPABASE_SMTP_FROM=noreply@yourdomain.com

# Optional: TLS/SSL Configuration
SUPABASE_SMTP_TLS=true
SUPABASE_SMTP_SSL=false
```

### Environment-Specific Configuration
```bash
# Development (.env.local)
SUPABASE_SMTP_HOST=smtp.resend.com
SUPABASE_SMTP_FROM=dev@yourdomain.com

# Staging (.env.staging)
SUPABASE_SMTP_HOST=smtp.resend.com
SUPABASE_SMTP_FROM=staging@yourdomain.com

# Production (.env.production)
SUPABASE_SMTP_HOST=smtp.resend.com
SUPABASE_SMTP_FROM=noreply@yourdomain.com
```

## Supabase Dashboard Configuration

### Step 1: Access SMTP Settings
1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Settings**
3. Scroll to **SMTP Settings** section
4. Click **Enable custom SMTP**

### Step 2: Configure SMTP Provider
```
SMTP Host: smtp.resend.com
SMTP Port: 587
SMTP Username: resend
SMTP Password: re_your-api-key
From Email: noreply@yourdomain.com
```

### Step 3: Configure Email Templates
1. Go to **Authentication** → **Email Templates**
2. Customize templates for:
   - **Confirm signup**: Email verification
   - **Invite user**: User invitations
   - **Reset password**: Password reset
   - **Change email**: Email change confirmation

### Step 4: Test Configuration
1. Click **Save** to apply settings
2. Test with a real email signup
3. Check email delivery and formatting
4. Verify links and redirects work correctly

## Advanced Configuration

### Custom Email Templates

#### Confirmation Email Template
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Confirm Your Email - MEXC Sniper Bot</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
        <h2 style="color: #2563eb;">Welcome to MEXC Sniper Bot!</h2>
        <p>Thank you for signing up. Please confirm your email address to get started.</p>
        
        <div style="margin: 30px 0;">
            <a href="{{ .ConfirmationURL }}" 
               style="background: #2563eb; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 4px; display: inline-block;">
                Confirm Email Address
            </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
            If you didn't sign up for MEXC Sniper Bot, you can safely ignore this email.
        </p>
    </div>
</body>
</html>
```

#### Password Reset Template
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reset Your Password - MEXC Sniper Bot</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
        <h2 style="color: #2563eb;">Reset Your Password</h2>
        <p>We received a request to reset your password for MEXC Sniper Bot.</p>
        
        <div style="margin: 30px 0;">
            <a href="{{ .ResetURL }}" 
               style="background: #2563eb; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 4px; display: inline-block;">
                Reset Password
            </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
            If you didn't request this reset, you can safely ignore this email.
            This link will expire in 1 hour.
        </p>
    </div>
</body>
</html>
```

### SMTP Configuration with Environment Detection
```typescript
// lib/smtp-config.ts
export const getSMTPConfig = () => {
  const environment = process.env.NODE_ENV || 'development'
  
  const baseConfig = {
    host: process.env.SUPABASE_SMTP_HOST,
    port: parseInt(process.env.SUPABASE_SMTP_PORT || '587'),
    user: process.env.SUPABASE_SMTP_USER,
    pass: process.env.SUPABASE_SMTP_PASS,
    secure: process.env.SUPABASE_SMTP_SSL === 'true',
    tls: process.env.SUPABASE_SMTP_TLS !== 'false',
  }
  
  const environmentConfig = {
    development: {
      ...baseConfig,
      from: `dev@${process.env.SMTP_DOMAIN || 'localhost'}`,
    },
    staging: {
      ...baseConfig,
      from: `staging@${process.env.SMTP_DOMAIN}`,
    },
    production: {
      ...baseConfig,
      from: `noreply@${process.env.SMTP_DOMAIN}`,
    },
  }
  
  return environmentConfig[environment] || baseConfig
}
```

## Domain Configuration

### Domain Setup for Better Deliverability
1. **Add SPF Record**:
   ```
   v=spf1 include:_spf.resend.com ~all
   ```

2. **Add DKIM Records**:
   ```
   resend._domainkey.yourdomain.com CNAME resend._domainkey.resend.com
   ```

3. **Add DMARC Record**:
   ```
   v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
   ```

### Subdomain Configuration
For better organization, use subdomains:
- `mail.yourdomain.com` for email sending
- `auth.yourdomain.com` for authentication redirects

## Testing SMTP Configuration

### 1. Test Script
```typescript
// scripts/test-smtp.ts
import { createSupabaseServerClient } from '@/src/lib/supabase-auth'

async function testSMTP() {
  console.log('Testing SMTP configuration...')
  
  try {
    const supabase = await createSupabaseServerClient()
    
    // Test email sending
    const { error } = await supabase.auth.resetPasswordForEmail(
      'test@example.com',
      {
        redirectTo: 'http://localhost:3008/auth/callback',
      }
    )
    
    if (error) {
      console.error('SMTP test failed:', error)
    } else {
      console.log('SMTP test successful!')
    }
  } catch (error) {
    console.error('SMTP test error:', error)
  }
}

testSMTP()
```

### 2. Manual Testing
```bash
# Test SMTP configuration
bun run scripts/test-smtp.ts

# Test specific email
curl -X POST "http://localhost:3008/api/test-email" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","type":"confirmation"}'
```

### 3. Email Validation
```typescript
// Test email delivery
const testEmailDelivery = async (email: string) => {
  const startTime = Date.now()
  
  try {
    const { error } = await supabase.auth.signUp({
      email,
      password: 'test-password-123',
    })
    
    if (error) {
      console.error('Email delivery failed:', error)
      return false
    }
    
    const deliveryTime = Date.now() - startTime
    console.log(`Email delivered in ${deliveryTime}ms`)
    return true
  } catch (error) {
    console.error('Email delivery error:', error)
    return false
  }
}
```

## Monitoring and Analytics

### Email Delivery Monitoring
```typescript
// lib/email-monitor.ts
export const emailMonitor = {
  trackDelivery: (email: string, type: string) => {
    console.log(`Email sent: ${type} to ${email}`)
    // Add to analytics/monitoring service
  },
  
  trackFailure: (email: string, error: any) => {
    console.error(`Email failed: ${email}`, error)
    // Add to error tracking service
  },
  
  getDeliveryStats: () => {
    // Return delivery statistics
    return {
      delivered: 0,
      failed: 0,
      pending: 0,
      bounced: 0,
    }
  },
}
```

### SMTP Health Check
```typescript
// api/health/smtp/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const smtpConfig = getSMTPConfig()
    
    // Test SMTP connection
    const testResult = await testSMTPConnection(smtpConfig)
    
    return NextResponse.json({
      status: 'healthy',
      smtp: {
        configured: !!smtpConfig.host,
        provider: smtpConfig.host,
        connection: testResult.success,
      },
    })
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error.message,
    }, { status: 500 })
  }
}
```

## Troubleshooting

### Common SMTP Issues

#### 1. "Authentication Failed" Error
**Cause**: Incorrect SMTP credentials
**Solution**: 
- Verify API key/password is correct
- Check SMTP username format
- Ensure API key has correct permissions

#### 2. "Connection Timeout" Error
**Cause**: Network or firewall issues
**Solution**:
- Check SMTP host and port
- Verify firewall settings
- Try alternative ports (465, 25)

#### 3. "TLS/SSL Handshake Failed"
**Cause**: SSL/TLS configuration issues
**Solution**:
- Check TLS/SSL settings
- Try different encryption methods
- Verify certificate validity

#### 4. "Sender Not Verified" Error
**Cause**: Domain or sender not verified
**Solution**:
- Verify domain in SMTP provider
- Add SPF/DKIM records
- Verify sender email address

### Debugging Steps

1. **Check Environment Variables**:
   ```bash
   echo $SUPABASE_SMTP_HOST
   echo $SUPABASE_SMTP_USER
   ```

2. **Test SMTP Connection**:
   ```bash
   telnet smtp.resend.com 587
   ```

3. **Check DNS Records**:
   ```bash
   dig TXT yourdomain.com
   nslookup -type=TXT yourdomain.com
   ```

4. **Review Logs**:
   - Check Supabase dashboard logs
   - Review SMTP provider logs
   - Check application logs

## Best Practices

### 1. Security
- Use environment variables for credentials
- Rotate API keys regularly
- Enable 2FA on SMTP provider accounts
- Use least privilege permissions

### 2. Reliability
- Configure multiple SMTP providers as fallbacks
- Implement retry logic for failed emails
- Monitor email delivery rates
- Set up alerts for delivery failures

### 3. Performance
- Use connection pooling
- Implement rate limiting
- Cache SMTP configurations
- Optimize email templates

### 4. Compliance
- Follow CAN-SPAM regulations
- Implement unsubscribe mechanisms
- Respect user preferences
- Maintain email lists properly

## Production Deployment

### 1. Pre-deployment Checklist
- [ ] SMTP provider configured and tested
- [ ] Domain verified and DNS records added
- [ ] Email templates customized
- [ ] Rate limiting configured
- [ ] Monitoring and alerts set up
- [ ] Backup SMTP provider configured

### 2. Deployment Steps
```bash
# 1. Set environment variables
vercel env add SUPABASE_SMTP_HOST
vercel env add SUPABASE_SMTP_USER
vercel env add SUPABASE_SMTP_PASS

# 2. Deploy application
vercel --prod

# 3. Test email functionality
curl -X POST "https://your-app.vercel.app/api/test-email" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### 3. Post-deployment Monitoring
- Monitor email delivery rates
- Check for authentication errors
- Verify template rendering
- Test all email flows

## Conclusion

Proper SMTP configuration is essential for a production-ready authentication system. By following this guide, you can:

- Eliminate Supabase email rate limits
- Improve email deliverability
- Customize email templates
- Monitor email performance
- Ensure reliable authentication flows

Choose an SMTP provider that matches your needs and budget, configure it properly, and implement monitoring to ensure consistent email delivery for your users.