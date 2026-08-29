# Unity Project Template (TCG Prototype)

> **Status:** Scaffolding / in-preparation. Engine logic is stubbed. Data is
> generated from the live 480-card `card_database.json`. `decks.json` now ships
> **70-card format-split decks** (`{ formats: { Classic, Standard } }`).

## Layout
```
unity/
  Assets/
    Scripts/            # C# gameplay (TCG namespace) — full port target
      CardData.cs       # POCO matching cards_full.json schema (Newtonsoft)
      CardDatabaseLoader.cs   # load-once, id-indexed (mirrors game.js __CARD_MAP__)
      GameState.cs      # [STUB] simulate.js GameState port
      CombatEngine.cs   # [STUB] game.js combat port
      CostSystem.cs     # [STUB] shared/cost-utils.js COST.* port
      KeywordSystem.cs  # [STUB] shared/keywords.js getKeywords port
      PhaseManager.cs   # [STUB] shared/phases.js port
    StreamingAssets/    # runtime-loaded data (ship here)
      cards.json        # generated from card_database.json (480 cards)
      decks.json        # copied from root (70-card format-split: Classic + Standard)
    Editor/
      CardImporterEditor.cs   # TCG > Build Unity Card Data (spawns node generator)
    Resources/          # reserved for RuntimeAssets
  ProjectSettings/      # stub (no committed .asset — create on first editor open)
  README.unity.template.md
```

## Dependency
- **Newtonsoft.Json** (UPM package `com.unity.nuget.newtonsoft-json`).
  Install via *Window → Package Manager → Unity Registry → Newtonsoft.Json*.
  Used because `cards_full.json` has mixed-type `cost` (`int | {color,generic}`)
  and mixed-type `abilities` (string keywords + JSON objects) that Unity's
  built-in `JsonUtility` cannot deserialize. The Node generator pre-normalizes
  nothing; parsing stays faithful to the live schema.

## Regenerate data
```
node build-unity-cards.js        # reads ../card_database.json -> Assets/StreamingAssets/cards.json (+ decks.json)
```
Or in-editor: **TCG → Build Unity Card Data**.

## Card schema source of truth
`cards_full.json` (480 cards: 100 Lands + 380 non-land). `build-cards.js`
(source-of-truth `transformCards()`) is the ONLY generator. All Unity C# field
names mirror that JSON (`CardData.cs`).

## What's stubbed
`GameState/CombatEngine/CostSystem/KeywordSystem/PhaseManager` are **preparation
stubs** — they document the JS port target and method surface. The full rules
port is gated on a valid 70-card `decks.json` (deferred). Hook them in when decks
are rebuilt.
