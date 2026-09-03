## What
<!-- 1-3 sentences. -->

## Blueprint
<!-- e.g. 1E identity lint / 2A deck builder / wave8-batch1 -->

## Scope
- **Touched:**
- **Not touched:** `unity/`, `tcg-unity-engine/`, `cards.json` (unless this PR is a data rebuild)

## Checklist
- [ ] `node --check` on edited JS
- [ ] `node recall_ominous_test.js` green
- [ ] `node build-cards.js verify` IDENTICAL (if card data touched)
- [ ] `node validate-data.js` + `node validate-identity.js` green
- [ ] Classic + Standard sims clean (if engine/UI/data touched)
- [ ] Unity step skipped (standing rule)
- [ ] Commit prefix: `feat:` / `fix:` / `docs:` / `refactor:` / `wave8:`

## Notes for reviewer
