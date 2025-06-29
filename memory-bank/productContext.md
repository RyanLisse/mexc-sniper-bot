# Product Context

## Purpose
MEXC Sniper Bot empowers crypto traders to capture early opportunities on the MEXC exchange by automatically detecting, analysing, and trading new token listings well before they go live.

## Problems Addressed
1. **Information Asymmetry** – Manual monitoring of upcoming listings is time-consuming and error-prone.
2. **Timing Precision** – Human traders struggle to enter positions within optimal launch windows.
3. **Pattern Complexity** – Ready-state signals (`sts:2`, `st:2`, `tt:4`) and market micro-structure patterns are difficult to recognise manually.
4. **Risk Management** – Ad-hoc trading lacks systematic safeguards and circuit breakers.

## Target Users
- Active crypto traders seeking automated edge.
- Quantitative strategy developers integrating the bot as a service.
- Power users wanting granular control over strategies and risk.

## User Experience Goals
- **Zero-Config Onboarding** – Guided setup wizard, environment checks, and sensible defaults.
- **Real-Time Insights** – Live dashboard with readiness status, confidence scores, and trade logs.
- **Safe by Default** – Clear visibility of risk parameters, circuit-breaker status, and safety alerts.
- **Extensible Workflows** – Workflow editor allowing custom Inngest triggers and strategy modules.
- **Transparent AI** – Explainable AI panels showing reasoning behind each trade/decision.

## Success Metrics
- <1 min average user setup time (local dev).
- >95 % positive feedback on clarity of dashboard and alerts.
- <0.2 % false-positive trade rate in production.
