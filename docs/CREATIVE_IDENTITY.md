# Creative Identity — TCG Prototype

**Status: TENTATIVE.** Voice is locked enough to author against. Palette wording and
banned-list may receive refinement waves; re-pass of already-authored cards is
allowed. Author to the current version of this file.

Canonical voice/style guide for all card text (`textPatch`) and flavor
(`flavorPatch`). Authoring agents READ THIS FIRST. Nothing in this doc imports
from an existing game; the voice is original.

## Global Voice

- **Terse, aphoristic, wry.** One clause where one clause works. "Some treasures
  bite." is better than "Some treasures are dangerous if you touch them."
- **Metaphor over description.** Say what the thing *means*, not what it does.
  "Every footstep seeds the next warcamp." — not "This scout helps you expand."
- **Wry darkness is welcome, cruelty is not.** Punchy irony, no gore for gore's sake.
- **No real-world proper nouns.** No Earth cities, no historic figures, no brand names.
- **No existing-game vocabulary.** No "planeswalker", "phasing", "trample", "tapped
  creatures" phrasing, no plane names. Keywords we DO use: Swiftstrike, Quickdraw,
  Keen Eye, Overrun, Deathshroud, Siphon, Flying, Intimidate, Guard, Bastion,
  Recall N, Ominous.

## Length Bounds

- Flavor: 1 sentence, ~4-12 words. Hard cap 16 words.
- Rules text: one ability per `\n`-joined line. Each line one sentence. No line
  over ~14 words.

## Faction Palettes

| Faction | Identity | Imagery bank | Example (real, shipped) |
|---|---|---|---|
| **Crimson** (red/burn) | war-forged, pyromaniac, transactional violence | fire, blood, mountain, volcano, cinder, ash, furnace, forge, receipt, debt | "Blood has a price; in Crimson, it comes with a receipt." |
| **Sunforged** (green/ramp) | patient, inevitable, growing | forest, jungle, root, thorn, seed, bloom, garden, heartwood, "the green court" | "The jungle does not ask permission." |
| **Lantern** (black/death) | grave-honest, ledger-of-the-dead | grave, crypt, reaper, disease, decay, shadow, mire, ash, candle, dawn-inversion | "Death is a ledger, and he holds the pen." |
| **Gilded** (blue/control/draw) | double motif: **sea** (tide, leviathan, reef, whirlpool, deep) + **wealth** (gold, coin, ledger, interest, receipt) | tide, leviathan, reef, whirlpool, deep, wave, gold, coin, ledger, accounting | "What the whirlpool takes, the whirlpool gives back." |
| **Zealot** (white/buffs+purge) | faith, decree, dawn-discipline | faith, blade, pilgrimage, consecrated, dawn, sun, roll call, repentance | "The pilgrimage ends at the blade's point." |
| **Colorless** (neutral/artifact) | machine, record-keeper, rust | rust, silver, gold, receipt, account, filing, catalog, ledger, machinery | "Every output requires an honest input." |

## Type Conventions

- **Champion (named/legendary):** third-person mythic. "Mountains bow to her; so do
  battlefields."
- **Spell / Instant:** the moment of action, cause→effect tersely. "The fire names
  its price."
- **Decree:** formal, legal, ledger-voiced. "Wealth is a promise; he keeps his word
  in gold."
- **Relic:** object with a history. "Nine legions marched to one heartbeat."
- **Domain:** a place. "The mire swallows both blessing and curse."
- **Omen:** foreshadowing, wrong-prophecy energy. "The prophecy was wrong — on purpose."
- **Land:** foundational, patient. "The jungle does not ask permission."

## Rules-Text Conventions (the `text` field)

- One ability per line, lines joined with literal `\n` in the JSON string.
- Keywords capitalized, always at their own position: `Swiftstrike`, `Flying`,
  `Guard`, `Recall 2`, `Ominous`.
- Use engine terms EXACTLY: `champion` (never "creature"), `purge`, `enemy leader`,
  `target`, `scry`, `drain`, `Saproling`, `Token`, `Recruit`, `Golem`, `Beast`.
- Trigger phrasings: `When this enters`, `Whenever this attacks`, `At the end of
  your turn`, `When you cast this`, `Once each turn`.
- Cost phrasing: `Pay 1 mana`, `costs 2 less`, `you may play an additional land`.
- Do NOT re-word an engine ability into something the engine doesn't do. `text` is
  a *display override*; `abilities` stay canonical.

## Banned

- MTG-specific terms not in our keyword list; real place names; brands; emojis;
  gendered pronouns on non-legendary cards; "to the moon"-style clichés.
