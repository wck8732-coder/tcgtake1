# TCG Prototype — Agent Context

## Project Overview
Web-based TCG with MTG-style mechanics, 5 factions, PvE vs AI, 60-card decks.
Working alpha with full game loop, AI, balance simulator.

## Key Files
- `game.js` — Main game engine (~2040 lines). Contains: GameState class (phases, combat, mana, abilities, AI, UI), CardRenderer, transformCards(), coin toss
- `simulate.js` — Headless AI vs AI batch balance simulator
- `cards.json` — 331 base card definitions (patched at runtime by transformCards())
- `decks.json` — 4 pre-made 60-card decks
- `index.html` — Game UI HTML layout
- `style.css` — Current card/UI styling
- `card-prototype.html` + `card-prototype.css` — NEW MTG-proportion card layout prototype
- `SESSION_SUMMARY.md` — Full session history
- `AGENTS.md` — This file (opencode context)

## Card System
- 5 factions: Volcano (#E65100), Forest (#2E7D32), Swamp (#6A1B9A), Ocean (#0277BD), Colorless (#546E7A)
- Card types: Creature, Spell, Instant, Enchantment, Land
- All cards get abilities at runtime via transformCards() patches (spellPatch, enchantPatch, instantPatch, keyword patches, legendary kits)
- Only vanilla creature: Pistonhammer Dwarf (173)

## Game Engine Features
- Phases: untap → draw → main1 → combat → main2 → end
- Combat: declare_attackers → declare_blockers → combat_damage (with first strike step)
- Keywords: Swiftstrike (haste), Quickdraw (first_strike), Keen Eye (vigilance), Overrun (trample), Deathshroud (deathtouch), Siphon (lifelink), Flying, Intimidate (menace)
- Mana: tap lands for colored mana, costs currently generic-only
- AI: 3 difficulties (Easy=random, Medium=prioritizes, Hard=board evaluation)
- Smart targeting with face targeting, Escape cancel
- describeAbility() renders effect text on cards
- Deck search effects shuffle afterwards

## MTG Card Layout (Prototype)
- Title Bar: Name (left) + Mana Cost (right)
- Art Box: ~45% card height
- Type Line: Card type + Expansion symbol (rarity)
- Text Box: ~35% — Rules text + Flavor text
- P/T Box: Bottom-right (creatures only)
- Info Strip: Artist + Collector number

## Active Work
- Need 5 faction mana symbols + generic mana circle (22px cost, 18px land, 14px inline)
- Card art generation pipeline (AI images)
- Color palette implementation

## Related Project (for reference)
- `D:\xfr\Downloads\tcgtake1` — Godot concept with CSV card database (120 cards, different factions: Crimson Thrones, Lantern Covenant, Sunforged Dominion, Gilded Axiom, Neutral). Different terminology: Champion/Decree/Omen/Domain/Relic. Plan is to merge design concepts into this web prototype.

## Next Steps
1. Finalize mana symbols
2. Integrate card layout into game UI
3. Port CSV faction designs into web engine
4. Add colored mana costs
5. Balance pass using simulate.js
