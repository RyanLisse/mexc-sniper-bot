# MEXC Sniper Bot - Quick Start Guide 🚀

## ⚡ Quick Setup (2 minutes)

### 1. Install Dependencies
```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Configure Environment
Create a `.env.local` file:
```bash
# Required
OPENAI_API_KEY=your-openai-api-key

# Optional MEXC API credentials
MEXC_API_KEY=your-mexc-api-key
MEXC_SECRET_KEY=your-mexc-secret-key

# For OpenAI Codex specific features (optional):
# Run `python scripts/setup_openai.py` to configure your OpenAI key for Codex.
# This will create a .openai_config.json (gitignored).
```

### 3. Start Development Servers

**Terminal 1 - Next.js Frontend:**
```bash
npm run dev
# Open http://localhost:3000 in your browser
```

**Terminal 2 - Python API:**
```bash
npm run mexc-agent-dev
# API runs on http://localhost:8001
# Docs at http://localhost:8001/docs
```

**Terminal 3 - Inngest (optional):**
```bash
npx inngest-cli dev --no-discovery -u http://localhost:3000/api/inngest
# Dashboard at http://localhost:8288
```

## 🎯 What the Bot Does

1. **Monitors** new coin listings on MEXC exchange
2. **Analyzes** token patterns using AI agents
3. **Discovers** trading opportunities before launch
4. **Provides** strategic recommendations
5. **Executes** trades automatically (when configured)

## 📊 Key Features

- AI-powered pattern discovery
- Real-time dashboard
- Automated trading strategies
- Risk management tools
- Performance analytics

## ⚙️ Configuration Options

Edit `src/config.py` to customize:
- `DEFAULT_BUY_AMOUNT`: USDT per trade (default: 100)
- `MAX_CONCURRENT_SNIPES`: Parallel trades (default: 3)
- `READY_STATE_PATTERN`: Token readiness pattern
- `STOP_LOSS_PERCENT`: Stop loss trigger (default: -10)

## 🔍 Quick Commands

Check system status:
```bash
curl -X GET http://localhost:8001/api/agents/mexc/status
```

Start pattern discovery:
```bash
curl -X POST http://localhost:8001/api/agents/mexc/pattern-discovery \
  -H "Content-Type: application/json" \
  -d '{"action": "start"}'
```

## ⚠️ Important Notes

1. **API Keys**: Ensure your OpenAI API key is valid
2. **MEXC Credentials**: Optional but recommended for full functionality
3. **Development**: Use small amounts when testing
4. **Production**: Deploy to Vercel for best performance

## 📈 Next Steps

1. Explore the dashboard at http://localhost:3000/app/dashboard
2. Read the [full documentation](README.md)
3. Configure your trading parameters
4. Deploy to production when ready

- Be aware that a CI/CD workflow runs on GitHub Actions for pushes/PRs to `main` to ensure code quality.

Happy trading! 🎯💰