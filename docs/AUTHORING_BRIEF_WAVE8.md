# Wave 8 Authoring Brief — Final Card Text + Flavor

Delegated workstream. Read `docs/CREATIVE_IDENTITY.md` FIRST, then this file.
Identity doc is **TENTATIVE** — author to the current version; re-pass is allowed.

## Goal
Author final rules text (`text`) + italic flavor (`flavor`) for every remaining
un-authored non-land card. **Do not trust a hard-coded remaining count.** Verify
the exact set on arrival with the finder below, then split into **2 batches of
~48**.

## Scope
- **IN:** `tcg-web-prototype/build-cards.js` — add entries to `textPatch` AND
  `flavorPatch` only.
- **OUT (NEVER touch):** `cards.json`, `card_database*.json` (all 4),
  `rules_engine.js`, `game.js`, `shared/*`, `unity/`, `tcg-unity-engine/`.

## Pre-flight
1. Run the finder (below) from `tcg-web-prototype/`. Save the remaining roster.
2. Read `docs/CREATIVE_IDENTITY.md`.
3. Read `tcg-web-prototype/AGENTS.md` + `tcg-web-prototype/notesfc.txt`.

## Find the remaining cards
Run from `tcg-web-prototype/`:

```
node -e "const d=require('./card_database.json'); const fs=require('fs'); const s=fs.readFileSync('build-cards.js','utf8'); const slice=(a,b)=>s.slice(s.indexOf(a),s.indexOf(b)); const ids=block=>[...block.matchAll(/^\s+(\d+):/gm)].map(m=>+m[1]); const t=new Set(ids(slice('const textPatch','const flavorPatch'))); const f=new Set(ids(slice('const flavorPatch','const rebalancePatch'))); const miss=d.filter(c=>c.type!=='Land'&&(!t.has(c.id)||!f.has(c.id))); const by={}; miss.forEach(c=>by[c.color]=(by[c.color]||0)+1); console.log('remaining:',miss.length,by); miss.forEach(c=>console.log(c.id+'\t'+c.color+'\t'+c.type+'\t'+c.name));"
```

A card is remaining if it is non-land AND missing from `textPatch` OR `flavorPatch`.

## Batch structure
Two batches, faction-grouped, self-reviewable:

| Batch | Branch | Contents |
|---|---|---|
| 1 | `feat/wave8-batch1` | first ~48 remaining ids (group by faction) |
| 2 | `feat/wave8-batch2` | the rest |

One PR per batch. Do not start batch 2 until batch 1 is merged (or parked on its
own branch if working in parallel worktrees — then rebase batch 2 onto main
after batch 1 lands).

## Per-card rules
- `text`: one ability per `\n`-joined line, engine-exact (see identity doc).
- `flavor`: 1 sentence, 4-12 words, faction-palette metaphor.
- **Apostrophes MUST be `\'`-escaped** inside the single-quoted values.
- The card id in the patch map MUST match the id in `card_database.json` exactly.
- Semantics must not change. Original mechanics/keywords are allowed only if
  they do not import from another established game.

## Verify (per batch)
From `tcg-web-prototype/`:

```
node build-cards.js build
node build-cards.js init
node build-cards.js verify
node recall_ominous_test.js
node simulate.js 10 medium Classic
node simulate.js 10 medium Standard
```

Expect: IDENTICAL + 0 schema violations; tests green; sims clean.
Skip Unity regen (standing rule — another agent's workstream).

## Commit
`wave8: author batch[N] — [k] non-land cards (faction list)`

## Done when
All remaining non-land ids present in BOTH `textPatch` and `flavorPatch`;
build + verify identical; tests green; sims clean.
