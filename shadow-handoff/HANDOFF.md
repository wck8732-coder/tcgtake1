# SHADOW-PC HANDOFF — TCG Master Project (2026-09-04)

You are picking up on the shadow PC exactly where the GUI-PC agent left off.
Read this whole file before touching anything. The recreation task is in
`RECREATE_ROUTER_PROMPT.md`; this file is the intuition behind it.

## 1. Machine map

- **GUI PC (main):** everything below lives at
  `C:\Users\Blayne\Desktop\tcg_master_project`, git repo, branch `main`,
  remote `https://github.com/wck8732-coder/tcgtake1.git`.
  Your shadow folder is a copy of a slice of this — paths WILL differ on
  your machine. Never hardcode `C:\Users\Blayne\...` paths; resolve relative
  to your working folder (the router already does: `_here` + `BASE_DIR`).
- **Shadow PC (you):** runs the local model server + the fallback router you
  are about to build. The GUI PC's OpenCode will point at you over the
  network (user handles the tunnel/firewall) or you run sessions locally.

## 2. Router deep-dive (your main context)

- **Canonical file:** project-root `router.py` (your `shadow-handoff/router.py`
  is byte-identical, SHA `AF87C0...41E030`). FastAPI + httpx + uvicorn.
- **What it does:** OpenAI-compatible gateway. Accepts chat (`/v1/chat/
  completions`), Responses (`/v1/responses`), and Messages (`/v1/messages`)
  shapes, normalizes to chat-style messages, classifies each request
  (`simple|creative|coding|general|vision` via `CODING_RE` + image sniffing),
  then walks a per-category provider chain until one returns 200. Adapts
  protocols both ways; converts every success back to the incoming shape.
- **Chains (cost-ordered, cheapest first):** external keys (Mistral Small,
  Alibaba Qwen Plus / Qwen3-Coder Plus, Gemini Flash) BEFORE all Go models;
  Go volume tier before Go mid tier; Go premium (`glm-5.3`, `kimi-k3`) are
  terminal-only, enforced at startup by `_assert_cost_ordering()` — a premium
  entry before an ordinary one raises `RuntimeError` instead of spending.
- **Key hygiene:** `_strip_incompatible_keys()` removes Responses-only keys
  before chat upstreams. Streaming is faked server-side (upstream always
  `stream: False`, then re-emitted as SSE) — keep this; some upstreams break
  on real streaming.
- **Endpoints:** `/v1/health` (open), `/v1/router/status` (secret-gated,
  returns ring-buffer events + `GO_CATALOG`), `/v1/models` (advertises ONE id:
  `hermes-router-auto` — OpenCode is configured to that id, so keep it).
- **Config (env only, never files):** `ROUTER_HOST` (default 127.0.0.1),
  `ROUTER_PORT` (8000), `ROUTER_SHARED_SECRET` (Bearer token OpenCode sends),
  `ROUTER_TIMEOUT` (60s), `ROUTER_RELOAD`, `ROUTER_LOG_FILE`. Key env names:
  `MISTRAL_API_KEY`, `ALIBABA_API_KEY`, `GOOGLE_API_KEY`,
  `OPENCODE_GO_API_KEY`. Values live in `.env` / hermes `.env` fallbacks —
  names are safe to repeat, VALUES never leave their machine.
- **Runtime discipline:** `start-router.ps1` enforces one listener per port
  (pidfile kill + orphan `Get-NetTCPConnection` sweep + readiness probe).
  `router-smoke.ps1` = 9 checks (health, status 401-without-token /
  200-with-token, 6 request shapes). Exit 0/1/2 = pass/shape-fail/no-listener.
- **Live state at handoff:** router pidfile holds 6764, port-8000 listener is
  pid 3316 (supervisor/worker pair — normal). HEAD is `0e8282a`.
- **Why you exist:** the Go **weekly quota is exhausted**. Your fallback
  router must NEVER call Go. Local-first, free-tier APIs as backup.
- **Port plan:** 8000 = primary, 8001 = another agent's Hermes copy default
  (a file named `router.py` also exists under `tcg-web-prototype/
  tcg-web-prototype/` — NOT yours, do not touch), **8002 = your fallback**,
  8080 = planned llama-server. Your pidfile: `router-fallback.pid`.

## 3. Local model plan (what to serve on :8080)

- **Primary — Devstral Small 2 24B, Q5_K_M** (~16.8GB → ~18GB at 32K ctx,
  Apache 2.0, 68% SWE-bench Verified, agentic-first). Serve with a CURRENT
  llama-server (needs the Mistral-3 attention fix; stock Ollama may garble
  this release): `llama-server -hf bartowski/mistralai_Devstral-Small-2-
  24B-Instruct-2512-GGUF:Q5_K_M --port 8080 -ngl 99 -c 32768 --jinja`.
  Fallback if it misbehaves: Devstral Small 2507 on stock Ollama.
- **Secondary — Qwen3-Coder-30B-A3B, IQ4_XS** (16.4GB, Apache 2.0). Q4_K_M
  does NOT fit 20GB — stay at IQ4_XS/8–16K ctx, or UD-Q4_K_XL for
  single-shot quality at 8K ctx.
- **Doctrine:** context budget beats weights. Start 16–32K, watch
  `nvidia-smi`, raise only on demand. Local = unlimited volume + privacy;
  it trails frontier APIs on the hardest reasoning — that is what the
  API tiers are for once quota resets.

## 4. Project state (game side — background, don't touch without orders)

- **Stack:** browser TCG prototype. `rules_engine.js` (canonical pure
  engine, no DOM) → `game.js` (UI layer, `extends RULES_ENGINE.GameState`)
  → `simulate.js` (headless AI-vs-AI). 480 cards (100 lands + 380 non-land),
  12 premade 70-card decks (Classic/Standard).
- **Health:** 130/130 tests (`recall_ominous_test.js`), 6-step verify gate
  green (`verify.ps1`; Unity step ALWAYS skipped — standing rule).
- **Just shipped (HEAD `0e8282a`, 8 commits, all pushed):** hover glossary
  (`shared/glossary.js`), in-browser deck builder (`builder-ui.js` +
  `shared/deck-rules.js`), collection + saved-deck persistence
  (`shared/collection.js`, `tcg.v1.*` localStorage, full-unlock alpha),
  AI speed toggle, mulligan polish, end-game stats, identity lint + CI
  (`.github/workflows/verify.yml`), creative-identity voice guide
  (`docs/CREATIVE_IDENTITY.md`, TENTATIVE).
- **Live docs:** `tcg-web-prototype/AGENTS.md` (agent context),
  `tcg-web-prototype/notesfc.txt` (master handoff), `docs/CURRENT.md`
  (auto-generated snapshot — refresh via `node tcg-web-prototype/
  update-handoff.js`), `docs/AUTHORING_BRIEF_WAVE8.md` (delegation packet).

## 5. Agenda (so your work lands in the right future)

- **Wave 8 (delegated):** only 7 cards remain un-authored (22/23/27/30/31
  Crimson, 101 Lantern, 497 Zealot) — one small PR, not two batches.
- **Next build phases:** B = internal premade-deck generator (mono-faction
  ×2–3, AFTER builder — now unblocked); C = Cinders economy model (name
  locked, rates later; crafting now, peer trade deferred to PvP); D = PvE
  ladder (8 rungs, weekly rotation, easy/normal/card-shark; `ranked` is a
  stub for the PvP project). Originality pitches 1–4 are AUTHORIZED to
  prototype. Multiplayer = separate project; engine is already pure so it
  can run server-side — do NOT add netcode here.
- **Release:** v0.1054 tag after Wave 8 + builder track (builder track is
  done). Frozen: AI-speed work (done), keyboard nav, rarity tooltips,
  checkpoints, AGENTS.md rewrites.

## 6. Standing rules (violations cause real damage)

- **Unity is another agent's workstream.** Never read/write/commit under
  `unity/` or `tcg-unity-engine/`. Untracked files from that agent currently
  sit in the tree (`tcg-unity-engine/*`, `tcg-web-prototype/
  tcg-web-prototype/`) — leave them alone.
- **No commits unless the user explicitly says "commit".**
- Conventional commits (`feat:`/`fix:`/`docs:`/`refactor:`/`wave8:`), one
  blueprint per branch, gate green before merging. User reviews PRs and
  owns branch-protection/CODEOWNERS settings.
- Verify-gated releases; snapshot (`backups/create-checkpoint.ps1`) before
  major work. One-time scratch files go in the OS temp dir, never the repo.
- **Security (requires user action, still open):** `opencode.json` contains
  5 live API keys — rotate them, redact the file, delete `opencodec.json`.
- Cost doctrine: free/local first, cheap volume next, premium terminal-only.

## 7. Verify commands (run from `tcg-web-prototype/`)

```powershell
node --check game.js  # + any edited JS
node recall_ominous_test.js          # 130/130 must stay green
node validate-data.js                # data checks
node validate-identity.js            # voice lint (5 pass, 1 warn known)
node simulate.js 10 medium Classic   # sims must be clean
node simulate.js 10 medium Standard
powershell -ExecutionPolicy Bypass -File verify.ps1  # full gate, Unity skipped
```
