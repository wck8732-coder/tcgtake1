# PROMPT — Recreate this router as the fallback (quota-proof) router

Paste everything below the line to the agent on the shadow PC.

---

## Prerequisites — read IN ORDER (repo root = where you ran `git pull`)

1. `shadow-handoff/HANDOFF.md` — full briefing. Read all of it.
2. `shadow-handoff/RECREATE_ROUTER_PROMPT.md` (this file, below the line) — the task.
3. `shadow-handoff/router.py` — byte-identical reference copy. Do NOT edit.
4. `start-router.ps1` (repo root) — template for your starter script.
5. `router-smoke.ps1` (repo root) — template for your smoke script.
6. `README.md`, "AI Router" section only — how OpenCode wires to a router.

Read nothing else unless the task forces you to. Never open
`card_database*.json`, `cards.json`, `decks.json`, `backups/`, `unity/`,
or `tcg-unity-engine/` — huge or off-limits.


You are working on the shadow PC. In your working folder you have `router.py`
(byte-identical copy of the canonical project router, SHA
`AF87C0ECE8996852258D28A857146830E78E056E8C98DA219A7A1F65C941E030`)
and `HANDOFF.md` (full project briefing — read it first, then do the task).

## Situation

The primary router (`router.py`, port 8000) routes OpenCode requests across
external API keys first, then OpenCode Go models. The Go **weekly quota is
exhausted**, so this machine needs a second router that never touches Go.

## Task

Create `router-fallback.py` in your working folder, derived from `router.py`,
with these changes — nothing else:

1. **Port:** listen on `127.0.0.1:8002` (default via `ROUTER_PORT`, so keep the
   env override). Do NOT use 8000 (primary router) or 8001 (claimed by another
   agent's Hermes router copy).
2. **Pidfile:** `router-fallback.pid`, with the same orphan-kill discipline as
   `start-router.ps1` (kill stale pid, kill orphans bound to your port).
3. **Tier-0 local backend:** add providers for the on-machine model server
   (llama-server OpenAI-compatible endpoint, default `http://127.0.0.1:8080`):
   - `local-devstral` → model `devstral-small-2`, first in every chain.
   - `local-qwen-coder` → model `qwen3-coder-30b`, second for `coding`.
   - Local providers need NO api key — send `Authorization: Bearer x` or
     nothing, whichever your llama-server accepts. If the local server is
     down or refuses, log a warning and fall through (never 503 while a
     free API key remains untried).
4. **Free-tier APIs next, unchanged:** keep the Mistral / Alibaba / Gemini
   provider entries and their order exactly as in the copy. Read keys from
   the same env-var names (`MISTRAL_API_KEY`, `ALIBABA_API_KEY`,
   `GOOGLE_API_KEY`); ask the user for values, never invent them.
5. **No Go, ever:** delete every `go_*` provider, the `GO_CATALOG`, and any
   Go URL. If a chain would be left empty for some category, that is a
   startup error — fail fast, don't silently narrow.
6. **Keep verbatim:** the `_assert_cost_ordering()` guard (extend it if you
   add tiers — local is cheapest and must sort first), the
   `_strip_incompatible_keys()` cleaner, all three protocol adapters
   (chat/responses/messages) and converters, the `/v1/health`,
   `/v1/router/status`, `/v1/models` endpoints, and the `hermes-router-auto`
   model id (drop-in swap with the primary router).
7. **Starter scripts:** `start-fallback-router.ps1` (mirrors
   `start-router.ps1`: pidfile + orphan-kill + readiness probe on your port)
   and `router-fallback-smoke.ps1` (mirrors `router-smoke.ps1`: health,
   401/200 status checks, all 6 request shapes against port 8002).

## Acceptance (all must hold)

- `python -m uvicorn router-fallback:app --host 127.0.0.1 --port 8002` starts
  with no cost-guard or import errors.
- Fallback smoke: 9/9 green (health, status 401/200, 6 shapes).
- With the local model server STOPPED, a chat request still succeeds via a
  free-tier API key (prove the fall-through).
- With the local model server RUNNING, `/v1/router/status` events show the
  `local-*` provider winning.
- No secret is written into any file. No changes outside your working folder.

## Standing rules (inherited)

- No commits unless the user explicitly says "commit".
- No Unity work (`unity/`, `tcg-unity-engine/`) — another agent owns it.
- One-time scratch files go in the OS temp dir, never the project folder.
- Verify before you claim done; report failures instead of stacking fixes.
