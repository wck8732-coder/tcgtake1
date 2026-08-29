---
description: Rotate API keys across providers. Moves to the next key in the ring, updates .env.local, and verifies the active key.
agent: build
---

# Rotate API Keys

Rotate the active API key for one or all providers. The key ring lives at
`.opencode/state/key-rotation.json` (`{ "providers": { "<id>": { "keys": [...], "current": n } } }`)
and env-var fallbacks are declared in `.opencode/plugins/rotate-keys.js` (`ENV_MAP`).

$ARGUMENTS

Follow these steps in order:

1. **Parse the request.** If a provider id is given (google, provocative, groq,
   nvidia, openrouter, openrouter2), rotate only that provider; otherwise rotate
   all providers that have keys in the ring or an env fallback.

2. **Read the current ring.** `Read .opencode/state/key-rotation.json`. If it is
   missing, treat each provider as `{ keys: [], current: 0 }`.

3. **Advance each provider.** For the target provider(s):
   - If `keys` has 2+ entries: increment `current` (wrap to 0). Persist the ring.
   - If `keys` has 0-1 entries: there is nothing to rotate to automatically.
     Tell the user they must add a fresh key (paste it into the ring file, or set
     the provider's env var). Never invent or fabricate keys.

4. **Update `.env.local`** so it reflects the intended active key for each
   rotated provider (paste the new value under the matching `*_API_KEY` line).
   Keep this file local-only; never commit it.

5. **Verify.** Confirm opencode.json contains NO inline apiKey values (it must
   only use `{env:...}` references). Confirm no secrets appear in the ring
   update beyond the intended key rotation.

6. **Report.** Summarize per provider: old index -> new index (or "no spare key —
   user must supply one"), whether .env.local was updated, and remind the user to
   **restart opencode** so the new key is picked up by the `config` hook. If a
   user message names the file, you may read it; otherwise use the file tools
   normally (large static data files are blocked by the ignore plugin).