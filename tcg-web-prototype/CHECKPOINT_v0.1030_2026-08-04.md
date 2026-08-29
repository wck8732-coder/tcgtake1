# TCG Prototype — CHECKPOINT v0.1030

**Version:** v0.1030
**Date/Time:** 2026-08-04 (local)
**Status:** Working alpha — faction rename complete, files migrated, integrity verified

> Resume here. This is the canonical checkpoint for resuming work later.
> Always-current agent context lives in `AGENTS.md`; older history lives in `SESSION_HISTORY.md`.

---

## 0. RESUME ACTIVATION (copy & paste to opencode)

```
Resume the TCG Prototype at C:\Users\Blayne\Documents\Default Project.

First read AGENTS.md (live context), then CHECKPOINT_v0.1030_2026-08-04.md (full resume checkpoint), and SESSION_HISTORY.md (archive) if needed.

Current version: v0.1030 (2026-08-04). Faction rename is COMPLETE: Volcano→Crimson, Forest→Sunforged, Swamp→Lantern, Ocean→Gilded across cards.json, decks.json, game.js, and simulate.js. Colorless remains Colorless (non-faction, outlaws/rejects lore). Zealots is the 5th official faction (green) but its 24 cards are NOT yet created. All files migrated into project folder. Integrity verified: both JS files parse, cards.json/decks.json valid JSON, 33/33 mechanic tests pass, sim clean (20 medium).

BACKUP SYSTEM: project snapshot lives at backups\v0.1030_2026-08-04_1543\ with SHA256 manifest. Verify anytime: powershell -ExecutionPolicy Bypass -File backups\verify-checkpoint.ps1. Restore: backups\restore-checkpoint.ps1 (auto-verifies first).

Next steps: 1) Port 120-card set (IDs 365-484) + design 24 Zealot cards (IDs 485-508) for equal faction counts, 2) Multi-pip mana costs ({generic, crimson:N} format), 3) New Omen flip triggers (ON_COMBAT_DAMAGE / ON_OPPONENT_SPELL / ON_ALLY_DIES), 4) New effects (grant_swiftstrike_ally, buff_ally_toughness, buff_all_allies, etc.), 5) Design gaps (double damage, recall_cost_less, dynamic cost, faction targeting), 6) 5 basic lands per faction (IDs 509+). Phase 7 (UI/card layout) is DELAYED until further notice.

Verify after any change: node -c game.js, node -c simulate.js, node simulate.js 5 easy. Every game.js change must be mirrored in simulate.js. Always snapshot before major work: backups\create-checkpoint.ps1 -Name v0.XXXX.
```

---

## 0b. BACKUP SYSTEM (corruption / data-loss protection)

- `backups/create-checkpoint.ps1` — copies the ENTIRE project (minus `backups/`) into
  `backups\<Name>_<yyyy-MM-dd>_<HHmm>\` and writes a `MANIFEST.sha256` (SHA256 per file).
  Also updates `backups\latest.txt`.
- `backups/verify-checkpoint.ps1` — checks snapshot internal integrity (corruption) AND
  flags live files that changed/deleted vs snapshot (normal edits shown in yellow; snapshot
  corruption is the only hard failure). Exit 0 = intact.
- `backups/restore-checkpoint.ps1` — auto-verifies snapshot integrity first, refuses to
  restore a corrupt snapshot, saves a `pre-restore_*` backup, then restores all files.
- Tested 2026-08-04: create→verify→tamper-detection→restore all passed.
- Current baseline snapshot: `backups\v0.1030_2026-08-04_1544`

## 1. What This Checkpoint Covers

This checkpoint captures the **faction identity rename** (first step of the official-set
strategy) and the **file migration + integrity sweep**:

- Renamed all 4 factions across the whole project (Volcano→Crimson, Forest→Sunforged,
  Swamp→Lantern, Ocean→Gilded) — done via `rename-factions.js` (now in project folder)
- Reclassified **Colorless** as a NON-faction (lore: outlaws/rejects from all factions);
  its 24-card future set is pure-splash (payable by any faction's lands)
- Confirmed **Zealots** = 5th + final faction for the 1st official set (green color),
  cards not yet designed (target: 24 cards, IDs 485–508)
- Migrated external files into the project folder
- Full integrity verification passed

---

## 2. Project Snapshot

| File | Purpose | Notes |
|------|---------|-------|
| `game.js` | Main engine: GameState (phases/combat/mana/abilities/AI/UI), CardRenderer, transformCards(), coin toss | ~2735 lines, SYNTAX OK |
| `simulate.js` | Headless AI-vs-AI batch balance simulator (mirrors game.js) | ~1787 lines, SYNTAX OK |
| `cards.json` | 331 base cards (patched at runtime by transformCards()) | valid JSON, 331 cards, max id 354, no dupes |
| `decks.json` | 4 pre-made 60-card decks | valid JSON, all factions renamed |
| `index.html` | Game UI HTML layout (exile zone stacks added) | — |
| `style.css` | Card/UI styling | — |
| `card-prototype.html` / `.css` | MTG-proportion card layout prototype | Phase 7 (DELAYED) |
| `AGENTS.md` | opencode agent context (live context) | needs refresh for v0.1030 |
| `SESSION_HISTORY.md` | Full session history archive | — |
| `CHECKPOINT_v0.1020_2026-08-01.md` | Previous checkpoint | — |
| `opencode.json` | opencode config (points at AGENTS.md) | — |
| `serve.bat` | Local server launcher: `npx http-server . -p 8080 -c-1` | — |
| `update-cards.js` | Card data generation script | — |
| `rename-factions.js` | **MIGRATED** — the faction-rename script (idempotent) | NEW in project |
| `recall_ominous_test.js` | **MIGRATED** — 33-test mechanic harness | NEW in project |
| `tcgtake1_master_card_database.csv` | **MIGRATED** — Godot 120-card reference DB (21.5 KB) | NEW in project |
| `GEMINI_MERGE_PROPOSAL.md` | Raw 120-card port doc (cards 406-484 + glossary) | RAW, not integrated |

---

## 3. Faction Identity (official-set strategy — DECIDED)

| Old Faction | New Faction | Color | Status |
|-------------|-------------|-------|--------|
| Volcano | **Crimson** | red/orange | renamed |
| Forest | **Sunforged** | white/yellow | renamed |
| Swamp | **Lantern** | purple/black | renamed |
| Ocean | **Gilded** | silver/blue | renamed |
| Colorless | **Colorless** | gray | unchanged — NON-faction (outlaws/rejects lore) |
| — | **Zealots** | green | NEW — 5th official faction, cards NOT created yet |

### Rename mapping applied (rename-factions.js)
`Volcano→Crimson, Forest→Sunforged, Swamp→Lantern, Ocean→Gilded`

### Verification results
- **cards.json**: valid JSON, 331 cards, no duplicate IDs, max id 354
  - Base color counts: Crimson 67, Sunforged 66, Lantern 66, Gilded 66, Colorless 66
  - Type counts: Land 80, Champion 79, Spell 65, Relic 54, Instant 53
  - NOTE: Crimson has +1 vs others (67 vs 66) — flag for equal-count pass later
- **Runtime-patched counts** (after transformCards): Crimson 72, Sunforged 70, Lantern 72, Gilded 73, Colorless 67; total 354 (274 non-land)
- **decks.json**: all 4 decks renamed, each 60 cards / 24 lands, sample card colors match deck factions
- **colorHex** (game.js:232): `{Crimson:'#c0392b', Sunforged:'#27ae60', Lantern:'#000000', Gilded:'#2980b9', Colorless:'#95a5a6'}`
- **factionColors** (game.js:2623): `{Crimson:'#e67e22', Sunforged:'#27ae60', Lantern:'#8e44ad', Gilded:'#2980b9'}`
- **Runtime Mythics (341–364)**: all use new faction names (verified)
- **Sim**: 20 medium games ran clean (no crashes); 33/33 recall/ominous tests pass
- No Volcano/Forest/Swamp/Ocean refs remain as faction names in .js files (only "Forestsong" card name)

---

## 4. Files Migrated INTO Project Folder

| File | Origin | Why |
|------|--------|-----|
| `tcgtake1_master_card_database.csv` | `D:\xfr\Downloads\tcgtake1\` | Design reference for 120-card port |
| `rename-factions.js` | `Temp\opencode\` | The rename script (keep for history) |
| `recall_ominous_test.js` | `Temp\opencode\` | 33-test harness (keep for regression) |

Left in temp (NOT migrated — scratch/junk): old `game.js` backup (7/29, 92 KB), `integrity-check.js`, `test_*.txt/.bat`, `test_perms.txt`, `test_write.txt`.

---

## 5. Official Set Plan (informed by GEMINI_MERGE_PROPOSAL.md + decisions)

The 120-card port (IDs 365–484) is captured in `GEMINI_MERGE_PROPOSAL.md`:
- CT (Crimson) 365–388, LC (Lantern) 389–412, SD (Sunforged) 413–436, GA (Gilded) 437–460, N (Colorless) 461–484
- Cost format: `{generic:N, color:M}` multi-pip objects — engine currently reads `{color, generic}` only (MUST extend for multi-pip)
- New flip triggers: `ON_COMBAT_DAMAGE`, `ON_OPPONENT_SPELL`, `ON_ALLY_DIES` (engine currently handles only START/END_OF_TURN)
- NEW_EFFECT glossary: grant_swiftstrike_ally, buff_crimson_attack, pump_stats_target, on_ally_dies (trigger), on_gain_life (trigger), pump_self_stats, sacrifice_then_draw, buff_ally_toughness, buff_all_allies
- DESIGN GAPS: double_fire_damage (CT19 Crucible of Wrath), recall_cost_less (LC18), dynamic cost reductions, faction-specific target filtering
- Zealots: 24 cards (IDs 485–508) to design for equal faction counts (12 Champions / 4 Decrees / 3 Relics / 3 Omens / 2 Domains per faction template)
- Lands: 5 basic lands per official faction (IDs 509+), functionally uniform, non-basic deferred
- Phase 7 (card layout / UI polish): DELAYED until further notice

---

## 6. Verified Commands

```
node -c game.js          # PASS
node -c simulate.js      # PASS
node -c update-cards.js  # PASS
node simulate.js 20 medium  # PASS (50/50 split, no crashes)
node recall_ominous_test.js  # PASS (33/33)
```

---

## 7. Next Steps (priority order)

1. **Port cards 365–484** (multi-pip costs, new triggers/effects, design gaps) — big engine work
2. **Design 24 Zealot cards** (IDs 485–508) — Gemini to design; green faction
3. **Equal-card-count pass** — balance factions so each official faction has equal counts on release
4. **5 basic lands per faction** (IDs 509+) — functionally uniform
5. **Refresh AGENTS.md** to v0.1030 faction identity
6. Phase 7 (UI/card layout): DELAYED until further notice
