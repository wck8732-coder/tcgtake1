# TCG Set Rebalance — Prompt for Gemini

You are the card-balancing director for a 480-card TCG (100 Lands + 380 non-land). Your job is to REBALANCE the existing set, not redesign it. Balance, mana curve, and type ratios should land within relative reason; beyond that, choose what serves the game. Better to give a faction or type real presence than to force symmetry for its own sake — but never at the cost of a champion-first core. Don't prefer any individual card; balance the set on its own merits.

## 1. Situation Report (guiding data only)

- **Set size:** 480 cards = 100 Lands (20 per colored faction; Colorless has 0) + 380 non-land.
- **Factions (5 colored + 1 neutral):** Crimson = red/burn/fast, Sunforged = green/ramp/fat, Lantern = black/death/edict, Gilded = blue/control/draw, Zealot = white/buffs/purge, Colorless = neutral/artifact (NOT a faction — neutral identity, no colored lands).
- **Types (all non-Land types count as "spells" generically):** Champion (creatures — the game is champion-centric), Spell, Instant, Decree, Relic, Omen, Domain.
- **Formats:** Classic and Standard — both allow max 4 copies/card, no rarity caps. Decks are 70 cards (24 lands + 46 non-land).
- **Current authored state:** 284/380 non-land cards carry final text + flavor (authoring is a display layer; abilities are canonical). Authoring is ongoing — do not gate balance on it.

## 2. Card Ratio Chart (current state — guidance, not mandate)

### 2a. Type spine — CHAMPION-CENTRIC
Current totals (380 non-land): Champion 137 (36.1%), Spell 64 (16.8%), Instant 65 (17.1%), Relic 61 (16.1%), Decree 25 (6.6%), Omen 17 (4.5%), Domain 11 (2.9%).

**Guiding principle:** the game is about champions first. The non-champion types (the "spells" collectively) should be present in healthy, playable quantities across the set — none of them should feel like filler, and none should crowd out the creature core. Exact counts are YOUR call within reason: if a type currently looks anemic (fewer than ~8-10 non-land slots), that is a flag to investigate, not an order to inflate it.

### 2b. Faction ⇄ Type affinities (each faction prizes one type)
| Faction | Affinity |
|---|---|
| Crimson | Instant |
| Sunforged | Relic |
| Lantern | Decree |
| Gilded | Omen |
| Zealot | Champion |
| Colorless | None (neutral spread) |

Each faction's affinity type should be its most-represented type (or tied for most). No faction may have its affinity type be its LEAST-represented type. Non-affinity types still exist in every faction (the affinities are leanings, not exclusions).

### 2c. Rarity — mana-curve-proportional, set-wide
Set-wide quotas are part of the set's skeleton: Common 175, Uncommon 208, Rare 48, Mythic 24, Legendary 25 (= 480 with Lands).

Per-faction skeleton: **8 Rares + 4 Mythics in EVERY faction.** Legendary 2-5 per faction.

Rarity should track the MANA CURVE foremost — the meat of the Common/Uncommon pools lives at the playable mid-cost range that fuels real games — and stay weighted across the whole set so no faction or type is left starved of a rarity. Treat rarity placement on an individual card as a lever that serves the curve, not a popularity contest.

### 2d. Mana curve (current, non-land, total CMC)
1→47, 2→89, 3→107, 4→75, 5→32, 6→16, 7→13, 8→1. Average ≈ 3.16.

Current shape is a healthy bell peaking at 2-3. Keep it reasonably bell-shaped around that center. You are allowed to add a little top-end density and/or trim 1-drop density if it makes factions and rarities feel better — sharpen the bell, don't flatten it out of existence.

## 3. Balancing Objective

Produce a set-wide rebalance that:
1. Keeps **Champion** the backbone of every faction's game plan.
2. Honors the **faction affinities** without gutting off-affinity cards.
3. Makes **rarity follow the mana curve**, weighted across the entire set, within the fixed quotas.
4. **Rewards rarity.** Playing a **Legendary must feel rewarding** — an on-board engine, a linchpin, the reason you built this deck. Playing a **Mythic must feel game-changing** — swings board state, breaks parity, or closes a game. Both keep **strategic importance baked in**: they are not mindless mana sinks; they reward sequencing, protection, and deck-building around them. Common/Uncommon stay the workhorses; Rare sits between glue and threat.
5. Respects the **engine schema** (Swiftstrike, Quickdraw, Keen Eye, Overrun, Deathshroud, Siphon, Flying, Intimidate, Guard, Bastion, Recall N, Ominous; Omen flip mechanics; Decree play-triggers; Colorless = artifacts/neutral only).
6. Improves current weak archetypes (report which decks/colors underperform and why).

## 4. Boundaries

Treat these less as rules to recite and more as the project's identity — respect them the way you'd respect a design brief.

- **49 named showcase cards are the set's namesakes** — their NAME, FACTION, TYPE, and CORE IDENTITY should not be lost or rewritten. They can be rebalanced numerically (cost/stats/triggers) like anything else; just don't turn a named character into a different card. Complete list:

```
Legendary:
64 Rootgrinder Elephant (Sunforged) | 67 Verdant Colossus (Sunforged) | 72 Vinelash Serpent (Sunforged)
111 Noxious Wyrm (Lantern) | 112 Blightlord (Lantern) | 115 Gnarlroot Devourer (Lantern)
144 Abyssal Leviathan (Gilded) | 147 Maelstrom Maw (Gilded) | 157 Spire Kraken (Gilded)
166 Bronze Colossus (Colorless) | 181 Boulderback Ox (Colorless) | 200 Winding Constrictor (Colorless)
354 Magma Titan (Crimson) | 507 Saint-General (Zealot) | 580 High Inquisitor Vael (Zealot)
1023 Count Serevan (Crimson) | 1024 Duchess Vhalora (Crimson)
1047 Abraham Van Helsing (Lantern) | 1048 High Curator Seraphine (Lantern)
1071 King Mansa Musa (Sunforged) | 1072 General Lysander (Sunforged)
1095 Mansa Musa, Ledger King (Gilded) | 1096 Chronarch Selene (Gilded)
1119 Contracted Blade (Colorless) | 1120 Archivist of the Road (Colorless)

Mythic:
70 Ancient Treant (Sunforged) | 71 Wildwood Alpha (Sunforged)
105 Graveshambler (Lantern) | 107 Dread Knight (Lantern)
151 Marbleback Turtle (Gilded) | 152 Whirlpool Djinn (Gilded)
165 Steelshaper Mage (Colorless) | 167 Geargrind Construct (Colorless) | 171 Grindstone Guardian (Colorless)
341 Inferno Sovereign (Crimson) | 342 Emberheart Titan (Crimson)
343 Worldtree Ancient (Sunforged) | 344 Verdant Sovereign (Sunforged)
345 Lich Lord (Lantern) | 346 Plague Sovereign (Lantern)
347 Leviathan of the Deep (Gilded) | 348 Tidal Sovereign (Gilded)
374 Chronos Paradigm Shift (Colorless)
501 Archon of the Faith (Zealot) | 508 Avatar of the Flame (Zealot) | 519 Grand Executioner of Faith (Zealot) | 581 Aurelia, Archangel of Zeal (Zealot)
1021 Supper Unending (Crimson) | 1022 Sepulcher Ballroom (Crimson)
```

- **Colorless is neutral, not a faction** — no colored lands, no type affinity; its cards read as artifact-y and neutral.
- **Every faction keeps its 8 Rares + 4 Mythics** — that structure is part of the set's skeleton.
- **Work inside the 480-card shell and the engine's vocabulary** — no new keywords or zones; the set should feel like the same game, just better balanced.

## 5. Output Format

Return your work as:
1. **Assessment** — 3-6 bullets: what's driving the current imbalance (by faction, type, and rarity-vs-curve) and any archetypes that currently underperform.
2. **Rebalance plan** — a table of deltas: card id → field → old value → new value → one-line reason tied to the boundaries above.
3. **Coverage check** — confirm per-faction 8 Rare / 4 Mythic, rarity quotas intact, showcase cards unrecognized, Colorless treated as neutral, and the mana curve still bell-shaped.

Do not restate the whole card list. Be decisive — where a set "wants" an underused type or cost expanded or trimmed to feel good to play, say so and act on it.