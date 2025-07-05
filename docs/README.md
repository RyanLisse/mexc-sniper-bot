# MEXC Sniper Bot Documentation 📚

Welcome to the comprehensive documentation for the MEXC Sniper Bot project. This guide will help you navigate through all aspects of the system.

## 📖 Documentation Structure

### 🔐 Authentication System Documentation

#### Quick Start for New Developers
- **[Developer Onboarding Guide](DEVELOPER_AUTH_ONBOARDING_GUIDE.md)** - Complete setup guide for new team members (30 minutes)

#### Migration and Setup
- **[NextAuth to Supabase Migration Guide](NEXTAUTH_TO_SUPABASE_MIGRATION_GUIDE.md)** - Complete migration documentation
- **[SMTP Configuration Guide](SMTP_CONFIGURATION_GUIDE.md)** - Custom email setup for bypassing rate limits
- **[Supabase Email Confirmation Setup](SUPABASE_EMAIL_CONFIRMATION_SETUP.md)** - Development email bypass setup

#### Problem Solving
- **[Authentication Troubleshooting Guide](AUTH_TROUBLESHOOTING_GUIDE.md)** - Common issues and step-by-step solutions
- **[Supabase Rate Limit Fix](SUPABASE_AUTH_RATE_LIMIT_FIX.md)** - Rate limit solutions and workarounds

#### Advanced Topics
- **[Rate Limit Handling System](RATE_LIMIT_HANDLING_SYSTEM.md)** - System architecture and user experience

### 🏗️ Architecture Documentation
- [**Quick Agent Setup**](architecture/AGENTS.md) - Quick setup guide for AI agents (essential for developers)

### 🚀 Deployment & Operations
- [**Production Deployment Guide**](deployment/DEPLOYMENT.md) - Complete deployment instructions for Vercel & Railway
- [**NeonDB Best Practices**](deployment/neon-best-practices.md) - Database optimization and configuration

### 📘 Development Guides
- [**Quick Start Guide**](guides/QUICKSTART.md) - Get up and running quickly
- [**Secure Encryption Guide**](guides/SECURE_ENCRYPTION_QUICKSTART.md) - API key encryption setup
- [**Contributing Guide**](development/CONTRIBUTING.md) - Development guidelines and standards
- [**OpenCode Development**](development/OpenCode.md) - Open source contribution guide

### 🧪 Testing Documentation
- [**Stagehand E2E Testing**](testing/STAGEHAND_E2E_TESTING.md) - AI-powered end-to-end testing framework


## 🗺️ Quick Navigation

### For New Users
1. Start with [Developer Onboarding Guide](DEVELOPER_AUTH_ONBOARDING_GUIDE.md) for complete authentication setup
2. Then proceed to [Quick Start Guide](guides/QUICKSTART.md)
3. Review [Quick Agent Setup](architecture/AGENTS.md)
4. Configure using [Secure Encryption Guide](guides/SECURE_ENCRYPTION_QUICKSTART.md)

### For Developers
1. **Essential**: Read [Quick Agent Setup](architecture/AGENTS.md) - contains troubleshooting for common issues
2. Review [Stagehand E2E Testing](testing/STAGEHAND_E2E_TESTING.md) - AI-powered testing framework
3. Follow [Contributing Guide](development/CONTRIBUTING.md) - development standards

### For DevOps
1. Follow [Deployment Guide](deployment/DEPLOYMENT.md)
2. Configure [NeonDB Best Practices](deployment/neon-best-practices.md)

## 🔍 Key Features Documentation

### Multi-Agent AI System
- 16+ specialized TypeScript agents for comprehensive trading automation
- OpenAI GPT-4 integration for intelligent decision making
- Event-driven workflows with Inngest for reliable background processing
- Real-time MEXC pattern recognition (sts:2, st:2, tt:4)
- Supabase Auth with rate limit handling and email bypass

### Database Architecture
- NeonDB serverless PostgreSQL
- Global edge replication
- Drizzle ORM type safety
- Automatic migrations

### Trading Features
- MEXC ready state pattern detection
- 3.5+ hour advance detection
- Customizable take profit levels
- Risk management controls

### Security & Testing Features
- **Authentication**: Supabase Auth with session management and rate limit handling
- **Encryption**: AES-256-GCM encryption for sensitive data
- **Concurrency**: Transaction locking system for safe operations
- **Protection**: Rate limiting and CSRF protection
- **Testing**: Comprehensive test suite with Vitest, Playwright, and Stagehand
- **Quality**: 96%+ test pass rate (293 tests) with TypeScript strict mode

## 📝 Documentation Standards

All documentation follows these principles:
- **Clear Structure**: Organized by topic and audience
- **Code Examples**: Practical, runnable examples
- **Visual Aids**: Diagrams and screenshots where helpful
- **Version Tracking**: Updated with each major release
- **Cross-References**: Links between related topics

## 🤝 Contributing to Documentation

To contribute to the documentation:

1. Follow the existing structure
2. Use clear, concise language
3. Include code examples
4. Add diagrams for complex concepts
5. Update the index when adding new docs

See [Contributing Guide](development/CONTRIBUTING.md) for general contribution guidelines.

## 📞 Support

- **Technical Issues**: Check relevant documentation section
- **Bug Reports**: File on GitHub Issues
- **Feature Requests**: Use GitHub Discussions
- **Security Issues**: Contact maintainers directly

## 🔄 Documentation Updates

This documentation is continuously updated to reflect the current system architecture.

**Latest Updates (July 2025):**
- ✅ **Complete Supabase Authentication Migration**: Migrated from NextAuth to Supabase Auth
- ✅ **Comprehensive Authentication Documentation**: Added 6 detailed authentication guides
- ✅ **Rate Limit Handling System**: Implemented smart rate limit management and user experience
- ✅ **Email Bypass for Development**: Created development-friendly email confirmation bypass
- ✅ **SMTP Configuration Guide**: Detailed custom SMTP setup for production
- ✅ **Developer Onboarding Guide**: 30-minute setup guide for new team members
- ✅ **Troubleshooting Documentation**: Step-by-step solutions for common auth issues
- ✅ Updated technology stack (Next.js 15, React 19, TanStack Query)
- ✅ Added testing framework documentation (Vitest, Playwright, Stagehand)

For the latest updates, check the git history or release notes.