# TCG Master Project

Collectible-card-game prototype. Contains the web prototype (v0.1048), a Unity template, the
original 120-card generation provenance bundle, and checkpoint/verification tooling.

## Layout

| Path | Purpose |
|---|---|
| `tcg-web-prototype/` | **Web game** — full mirror of the live working copy (`Documents\Default Project`). All game/engine/data files, `verify.ps1` 7-step gate, `shared/` modules, `.opencode/` config. |
| `tcg-unity-engine/` | Reserved for the standalone Unity engine port (current template at `tcg-web-prototype/unity/`). |
| `docs/` | Future design/rule/roadmap docs. |
| `tools/` | Future repo-wide dev/CI tooling. |
| `archive/` | Future retired/legacy content. |
| `backups/` | Future local-only snapshot destination (not committed). |
| `router.py` | Local AI routing gateway. All OpenCode requests enter here; API keys are loaded from local environment files. |

## Quick start (web game)

```powershell
# verify everything (syntax + build identity + 123 tests + 116 data checks + Classic/Standard sims + Unity data)
powershell -ExecutionPolicy Bypass -File tcg-web-prototype\verify.ps1

# run tests / sims directly
node tcg-web-prototype\recall_ominous_test.js
node tcg-web-prototype\simulate.js 10
```

There is no folder `C:\Users\Blayne\Desktop\tcg_master_project\.gitignore` comment needed — see
`.gitignore` at this root: it keeps secrets, node_modules, and backup snapshots out of the repo.

## AI Router

Start the router before OpenCode:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-router.ps1 -Background
```

OpenCode uses `project-router/hermes-router-auto` from
`tcg-web-prototype/opencode.json`. The router classifies each request separately,
tries existing API-key providers before OpenCode Go, and protects expensive Go
models as terminal fallbacks. It accepts Chat Completions, Responses, and
Anthropic Messages requests. Check `http://127.0.0.1:8000/v1/health`, or query
`/v1/router/status` with the router bearer token to see the actual model used.

## Rules (from AGENTS.md / notesfc.txt)

- `cards.json` is the source input; `build-cards.js` transformCards is the ONLY truth for card data;
  generated DBs (`card_database*.json`) are NOT hand-edited.
- `rules_engine.js` is the canonical engine; `game.js` keeps only UI/async-AI/combat overrides.
- Never commit secrets: `.opencode/state/` (key ring), `*.opencode.json` files with keys, `.env*`.
- Snapshot the whole project before major work via `backups` tooling (see `backups/README.md`).

## Checkpoint Protocol

- Use a full snapshot before risky work or releases.
- Run `tcg-web-prototype\verify.ps1` before creating a release tag.
- Use Git commits and annotated tags as the durable history; local snapshots are recovery copies only.
- Keep the newest two local snapshots and remove older copies after confirming their Git history exists.
- Do not push secrets, `.env` files, router logs, generated caches, or ignored OpenCode state.
