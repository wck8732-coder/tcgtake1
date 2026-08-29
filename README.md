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

## Rules (from AGENTS.md / notesfc.txt)

- `cards.json` is the source input; `build-cards.js` transformCards is the ONLY truth for card data;
  generated DBs (`card_database*.json`) are NOT hand-edited.
- `rules_engine.js` is the canonical engine; `game.js` keeps only UI/async-AI/combat overrides.
- Never commit secrets: `.opencode/state/` (key ring), `*.opencode.json` files with keys, `.env*`.
- Snapshot the whole project before major work via `backups` tooling (see `backups/README.md`).