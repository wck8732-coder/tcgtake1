# Project Router

The project router is the single OpenCode entry point. It accepts OpenAI Chat,
OpenAI Responses, and Anthropic Messages requests, classifies each request,
tries external API-key providers first, then economical OpenCode Go models.
Protected Go models are only terminal fallbacks.

## Start

```powershell
powershell -ExecutionPolicy Bypass -File .\start-router.ps1 -Background
```

Health: `http://127.0.0.1:8000/v1/health`
Status: `http://127.0.0.1:8000/v1/router/status` with the router bearer token
Logs: `router.log`

The router loads local `.env` first, then the existing Hermes router and Hermes
environment files as compatibility fallbacks. No key is stored in source.
