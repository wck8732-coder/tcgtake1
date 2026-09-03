# Card DB re-audit (post-Wave-7) — 1C

Generated 2026-09-03. Read-only. No code changes.

## Headline

Wave 8 is **tiny**. Remaining un-authored non-land: **7 cards**, not ~96.
`docs/AUTHORING_BRIEF_WAVE8.md` still says verify-on-arrival — this report is
that verification. Collapse Wave 8 to **one batch**, not two of ~48.

Authored both `text` + `flavor`: **373 / 380** non-land.

## Remaining (need a patch)

| id | faction | type | rarity | name | gap |
|---:|---|---|---|---|---|
| 22 | Crimson | Champion | Common | Coppercoil Sprite | flavor only — needs `text` |
| 23 | Crimson | Champion | Common | Minted Sentry | flavor only — needs `text` |
| 27 | Crimson | Champion | Common | Penny Ante Scout | flavor only — needs `text` |
| 30 | Crimson | Champion | Common | Coinflip Imp | flavor only — needs `text` |
| 31 | Crimson | Champion | Rare | Siege Vaulter | neither |
| 101 | Lantern | Champion | Common | Plague Rat | flavor only — needs `text` |
| 497 | Zealot | Instant | Uncommon | Shield of Devotion | text only — needs `flavor` |

By faction: Crimson 5, Lantern 1, Zealot 1.

## Patch map health

| Check | Result |
|---|---|
| Duplicate `textPatch` keys | none |
| Duplicate `flavorPatch` keys | **487, 509, 576** (Wave 6 + later wave; last wins — harmless, messy) |
| Orphan ids (in patches, not in live DB) | **13** in both maps: 37, 118, 120, 188, 195, 197, 202, 206, 216, 226, 227, 327, 332 — all in `TRIM_IDS`. Dead entries, same class as the v0.1047 Goal 1 audit. Harmless. |
| `text` without `flavor` | 497 |
| `flavor` without `text` | 22, 23, 27, 30, 101 |

## Recommended action (not done here)

1. Wave 8 delegated agent: author the 7 remaining rows in one small PR (`feat/wave8-batch1`). Skip batch 2.
2. Optional cleanup (separate PR, not Wave 8): drop the 13 TRIM_IDS orphans from both maps; drop the first duplicate of 487/509/576 in `flavorPatch`.

## Not issues

- No duplicate `textPatch` keys.
- Live DB still 480 cards (100 land + 380 non-land) per finder.
- Engine/abilities untouched.
