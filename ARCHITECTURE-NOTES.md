# Architecture Notes — Router vs Fallback Router

## Files covered
- `router.py` (456 lines, FastAPI title `TCG Project AI Router`)
- `router-fallback.py` (411 lines, FastAPI title `TCG Project Fallback Router`)
- `start-router.ps1` (43 lines)
- `start-fallback-router.ps1` (41 lines)

## Relationship overview
`router-fallback.py` is a fork / derived copy of `router.py`, not an importer.
Its header states: `Derived from router.py (SHA AF87C0ECE8996852258D28A857146830E78E056E8C98DA219A7A1F65C941E030)`.
No Python file does `from router import ...` or `import router`; the grep for
`from router|import router|router\.py` across `*.py` hits only that docstring
comment in `router-fallback.py:3`. All shared logic (normalize/classify,
`messages_to_responses`, `messages_to_anthropic`, `call_upstream`,
`convert_response`, `sse_response`, `route_request`, 3 inbound protocols +
`/v1/health`, `/v1/router/status`, `/v1/models`) is duplicated verbatim, then
diverged per the `router-fallback.py:4-11` changelog.

The two `.ps1` starters are mirrors: same pidfile + orphan-cleanup + health-poll
pattern, different module/port/pidfile. They run independent uvicorn processes;
there is no automatic failover between them — the operator chooses which port
OpenCode points at.

## `router.py` — canonical primary (port 8000)
- Served as `router:app` by `start-router.ps1` on `127.0.0.1:8000`.
- Env: loads local `.env` first, then Hermes compat fallbacks
  `C:\Users\Blayne\AppData\Local\hermes\router\.env` and `...\hermes\.env`
  (`router.py:27-39`). Log: `router.log`.
- Providers (`router.py:73-96`): external keys first — Mistral, Alibaba
  general/coding, Gemini Flash — then Go volume tier
  (`go_deepseek_flash`, `go_glm_flash`, `go_longcat`, `go_qwen_flash`,
  `go_mini_max_fast`, `go_luna`), Go mid-tier (`go_kimi_code`, `go_kimi`,
  `go_deepseek_pro`, `go_qwen_plus`, `go_mini_max`, `go_vision`), protected
  premium terminal (`go_glm_premium`, `go_kimi_premium`).
- Chains (`router.py:222-228`): `simple/creative/coding/general/vision`, all
  external-first, premium last. `_assert_cost_ordering()` fails fast at startup
  if a non-premium entry ever follows a premium one.
- Status endpoint returns live `GO_CATALOG` (2026-09-01 catalog with
  `route` flags). Models endpoint id: `hermes-router-auto`.

## `router-fallback.py` — local-first niche variant (port 8002)
- Served as `router-fallback:app` by `start-fallback-router.ps1` on
  `127.0.0.1:8002` (default `ROUTER_PORT`). Log: `router-fallback.log`,
  pidfile: `router-fallback.pid`. Env: only local `.env`
  (`router-fallback.py:27-36`) — no Hermes fallbacks.
- Providers (`router-fallback.py:73-84`): Tier-0 local Ollama
   (`local-qwen` → `smtek/Qwen3.8-27B:Q3_K_XL-16gb` at `http://127.0.0.1:11434/v1/...`,
  dummy key `x`; optional `local-hermes` → `hermes3:8b` creative), then free
  APIs (Mistral/Alibaba/Gemini), then Go volume ONLY as niche
  (`go_qwen_flash`, `go_deepseek_flash`, `go_glm_flash`). No Devstral plan, no
  mid/premium tiers.
- Chains (`router-fallback.py:176-182`): every chain starts with `local-qwen`;
  Go entries appear only in `creative`/`general`. Cost guard changed: enforces
  `local-qwen must be first` plus the same premium-terminal check.
- `route_request` skips empty keys except `local` providers
  (`router-fallback.py:358`). Status endpoint returns `"catalog": {}` (no
  catalog). Models endpoint keeps the same `hermes-router-auto` id, so clients
  switch by port only.

## Starters
- `start-router.ps1`: checks `router.py` exists, kills PID in `router.pid` +
  any listener on `:8000` (`Get-NetTCPConnection`), `-Background` launches
  `python -m uvicorn router:app --host 127.0.0.1 --port 8000` hidden, writes new
  pidfile, polls `http://127.0.0.1:8000/v1/health` 20×500ms; foreground runs
  uvicorn directly.
- `start-fallback-router.ps1`: identical flow for `router-fallback.py` /
  `router-fallback:app` / `:8002` / `router-fallback.pid` /
  `http://127.0.0.1:8002/v1/health`.

## How to think about them
- Primary = cost-aware cloud router (external keys → cheap Go volume → premium
  terminal). Use when API keys / Go subscription are available.
- Fallback = local-first router (Ollama Qwen always first, free APIs next, Go
  only when classifier says a stronger model helps creative/general). Use
  offline / keyless / to conserve Go quota.
- They never call each other; pick one port (8000 vs 8002) per OpenCode session.
  Smoke/verify helpers (`router-smoke.ps1`, `router-fallback-smoke.ps1`) probe
  each independently.
