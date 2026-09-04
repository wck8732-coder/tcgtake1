# PROMPT — Recommend the model lineup for this project's router

Run this AFTER the fallback router is built and smoke-green, when the user
asks "what models do you suggest for the project". Read HANDOFF.md first if
you have not already — the workload below assumes that context.

## 1. Project scope (measured 2026-09-04, do not guess — verify if drifted)

- Core code read in a typical session: `game.js` 1,944 lines / 83KB,
  `rules_engine.js` 2,032 / 83KB, `build-cards.js` 1,387 / 114KB,
  `recall_ominous_test.js` 642 / 30KB, `builder-ui.js` 307 / 12KB,
  `index.html` 290, `style.css` 834, `router.py` 382. Whole working tree
  (excl. backups/unity/.git): **1.9MB, 90 files**.
- Card DB: 480 cards but only ~0.2MB on disk. Tests: 130. Sims are
  headless token-free work (no model involved).
- Token reality (≈4 chars/token): one full file read ≈ 20K tokens
  (game.js/rules_engine.js). A normal agent turn (system + 2–4 reads +
  tool echoes) lands **16–48K**. Refactor-scale work (e.g. the 44-method
  dedup across two files ≈ 170KB ≈ 42K of source alone) spikes past 100K.

## 2. Workload profile (what the models must survive)

- Long agentic coding loops: read → plan → edit → `node --check` → test →
  sim → commit. Tool-call accuracy matters more than chat flair.
- Routine turns (edits, refactors, tests, planning) are ~80% of volume and
  need GPT-4o-class code ability, NOT frontier reasoning.
- Hard debugging rabbit holes need frontier reasoning — rare, but real.
- Background agents (audits, authoring waves, sim analysis) burn tokens
  without supervision — these must cost $0 (local) or near-$0.
- Weekly rhythm previously hit the Go weekly cap, hence the fallback router.

## 3. Hardware (shadow PC)

- RTX A4500 **20GB VRAM** + **28GB system RAM**. VRAM budget per model =
  weights + ~1GB runtime + KV cache (KV grows with context; roughly
  2–4GB at 32K for a 24B dense model). Rule: **budget for context, not
  just weights** — a weaker model holding 32K beats a stronger one choked
  to 8K.

## 4. Go roster snapshot (Sept 2026, $10/mo flat; VERIFY before citing —
roster drifts; run `/models` in the OpenCode TUI or check opencode.ai/docs/go)

- `kimi-k2.7-code` — coding-tuned agent coder, 262K ctx, ~1,350 req/5h.
- `qwen3.7-plus` — 1M ctx mid-tier default, ~4,300 req/5h.
- `deepseek-v4-flash` — 1M ctx volume grinder, ~7,600 req/5h.
- `mimo-v2.5` — ultra-volume, ~30,100 req/5h.
- `qwen3.8-max` — premium rescue, ~160 req/5h. `kimi-k3`, `grok-4.6` —
  ~110–170 req/5h, terminal-only. Caps run $12/5h, $30/wk, $60/mo, then
  Zen top-up. 17/19 standard models are zero-day retention.

## 5. Your deliverable

Recommend FIVE slots, each with (a) exact model + quant + VRAM math
(weights + KV at YOUR stated context) for local, or model id + quota
math for Go; (b) one-paragraph why tied to sections 1–3 above
(cite a workload fact per pick); (c) license for local picks
(Apache 2.0/MIT preferred):

1. **Local daily driver** (tier-0 in the fallback router).
2. **Local secondary** (different strength: generation sprint vs agent
   loop, or an easy-fit fallback if #1 misbehaves on the runner).
3. **Go primary agent** (daily driver when quota is healthy).
4. **Go volume grinder** (token-burning foreground work).
5. **Go terminal rescue** (stuck-points only, with the quota cost stated).

Then state the combined doctrine in three lines: what runs by default,
what it escalates to, and what stays local no matter what. Flag anything
where your knowledge may be stale (releases after your cutoff) instead of
asserting it. No model ships until the user approves the slot.
