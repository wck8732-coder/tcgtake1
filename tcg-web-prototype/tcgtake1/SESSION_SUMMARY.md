# TCG Prototype — Session Summary (Jul 28, 2026)

## What We're Building
Web-based TCG with 5 factions (Volcano/Forest/Swamp/Ocean/Colorless), 
PvE vs AI, MTG-style mechanics, 60-card decks, 330+ cards.

## Key Files
- `game.js` — Game engine (~2040 lines) + card renderer + transformCards()
- `simulate.js` — Headless AI vs AI batch simulator
- `cards.json` — 331 card definitions
- `decks.json` — 4 pre-made 60-card decks
- `index.html` — Game UI layout
- `style.css` — Current card/UI styling (634 lines)
- `card-prototype.html` + `card-prototype.css` — NEW MTG-proportion prototype
- `SESSION_SUMMARY.md` — This file

## Current State
- All spells/instants/enchantments patched with abilities via transformCards()
- Smart targeting system (face targeting, Escape cancel, AOE auto-cast)
- Coin toss for first player
- describeAbility() renders effect text on cards
- Only 1 vanilla creature: Pistonhammer Dwarf (173)
- Shuffle after deck search (engine + card text)
- MTG-standard card layout designed (prototype files)

## Active Work
- Generating faction mana symbols via AI image generation
- Need: 5 mana symbols + generic mana circle at proper sizes

## Color Palette
| Faction | Primary | Dark | Light | Accent |
|---------|---------|------|-------|--------|
| Volcano | #E65100 | #BF360C | #FF8A65 | #FF6D00 |
| Forest  | #2E7D32 | #1B5E20 | #81C784 | #00C853 |
| Swamp   | #6A1B9A | #4A148C | #CE93D8 | #AA00FF |
| Ocean   | #0277BD | #01579B | #4FC3F7 | #00B0FF |
| Colorless| #546E7A | #37474F | #90A4AE | #B0BEC5 |

## Card Zones (MTG proportions)
Title Bar: Name (left) + Mana Cost (right)
Art Box: ~45% of card height
Type Line: Card type + Expansion symbol (rarity)
Text Box: ~35% — Rules text + Flavor text (italic)
P/T Box: Bottom-right (creatures only)
Info Strip: Artist + Collector number

## Mana Symbol Sizes by Context
- Title bar (cost): 22×22px
- Land tap ability: 18×18px
- Inline rules text: 14×14px
- Game board (small): 10×10px
- Master asset: 64×64px

## Next Steps
1. Finalize 5 faction mana symbols + generic mana circle
2. Integrate symbols into card renderer
3. Generate card art for prototype cards
4. Apply new card layout to game UI
5. Balance pass
