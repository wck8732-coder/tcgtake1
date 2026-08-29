# CHECKPOINT_v0.1041_2026-08-11.md

## Summary
Zealot (5th faction) card set integration into the live card DB.

## What was done
1. **96 new Zealot cards added** to `build-cards.js` `newCards` (ids 485–581):
   - 23 hero cards (485–508, minus 502) designed/validated first
   - 73 remainder cards (509–581) provided by user, validated
   - 96 = 31 Champion + 11 Spell + 11 Instant + 12 Relic + 7 Decree + 2 Domain + 2 Omen + 20 Land
   - Rarity breakdown: 46 Common, 26 Uncommon, 20 Rare, 2 Legendary, 2 Mythic

2. **Design fixes applied during validation:**
   - 490 Rallying Cry: `pump_all_champions` → `buff_all_allies` (effect does not exist)
   - 498 Crusader + 503 Paladin: `ON_COMBAT_DAMAGE` → `attacks` (flip-style trigger was wrong for non-Omens)
   - 515 Temple Justiciar: `ON_COMBAT_DAMAGE` → `attacks`
   - 548 Edict of Zeal: `pump_all_champions` → `buff_all_allies`
   - 553/554: removed `"Ominous"` keyword string (pure Omens — no champion to flip)
   - 502 Divine Vision removed (Ominous on a pure Omen is meaningless)

3. **Engine support files:**
   - `shared/factions.js`: `COLOR_HEX` + `COLOR_HEX_DECK` now include `Zealot` (`#ffc107` / `#b7950b`)
   - `build-cards.js` `transformCards()`: rarity skip now covers `485 <= id <= 581` (keeps Common/Uncommon/Rare/Legendary/Mythic intact, matching how ids >= 1000 work)

4. **Legendary handling:** 507 Saint-General + 580 High Inquisitor Vael carry `rarity: "Legendary"` inline, NOT in `legendaryChampionIds`, so they keep their own abilities (no kit override).

5. **Omen details:** 553 (Burning Seal) ON_COMBAT_DAMAGE + 554 (Martyrdom) ON_ALLY_DIES, both with `faceDownCost.generic: 2`, converted to uppercase triggers matching existing Omen convention.

6. **Lands:** all 20 Zealot lands flattened to `Zealot Land` name + Common rarity by the existing Land normalization (consistent with all other factions).

## Verification
- `node --check build-cards.js` → syntax OK
- `node build-cards.js build` → **580 cards** (484 + 96)
- `node build-cards.js init` + `verify` → all 4 copies identical
- Zealot spot-check: 96 cards, rarities exact (46C/26U/20R/2L/2M), types exact
- `node recall_ominous_test.js` → **96/96 pass**
- `node simulate.js 20` → clean, 50/50 medium, no crashes

## Snapshot
`backups/v0.1041_2026-08-11_2204` (verified intact)

## Next Steps
- Add ids 485–581 into `decks.json` (deck integration + balance pass)
- 5 basic lands per faction (IDs 509+ concept — Zealot lands already occupy 562–581)
- Then the remaining release tasks per AGENTS.md
