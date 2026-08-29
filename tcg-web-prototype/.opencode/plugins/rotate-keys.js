// rotate-keys.js
// Key-ring manager + auto-rotation for API keys.
//
// Keys never live in opencode.json (they are {env:...} refs there). This plugin
// supplies keys at startup (config hook) and per request (chat.headers), and
// rotates to the next key on auth/quota/rate-limit failures (event hook).
//
// Key sources, in priority order (per provider):
//   1. key ring:  .opencode/state/key-rotation.json  -> { providers: { <id>: { keys:[...], current:n } } }
//   2. env var:   per-provider (see ENV_MAP below)
//
// Rotate manually at any time with the /rotate-keys command.
import fs from "node:fs"
import path from "node:path"

export const RotateKeys = async ({ client, directory }) => {
  const stateDir = path.join(directory, ".opencode", "state")
  const stateFile = path.join(stateDir, "key-rotation.json")

  const ENV_MAP = {
    google: "GOOGLE_API_KEY",
    provocative: "PROVOCATIVE_API_KEY",
    groq: "GROQ_API_KEY",
    nvidia: "NVIDIA_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
    openrouter2: "OPENROUTER2_API_KEY"
  }
  const HEADER_MAP = {
    google: "x-goog-api-key",
    _bearer: "Authorization" // openai-compatible: Authorization: Bearer <key>
  }
  const BEARER_PROVIDERS = ["provocative", "groq", "nvidia", "openrouter", "openrouter2"]

  function loadRing() {
    try {
      if (fs.existsSync(stateFile)) {
        return JSON.parse(fs.readFileSync(stateFile, "utf8"))
      }
    } catch (err) {
      client.app.log({ body: { service: "rotate-keys", level: "warn", message: `failed to read key ring: ${err}` } })
    }
    return { providers: {} }
  }

  function saveRing(ring) {
    try {
      if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true })
      fs.writeFileSync(stateFile, JSON.stringify(ring, null, 2))
    } catch (err) {
      client.app.log({ body: { service: "rotate-keys", level: "error", message: `failed to write key ring: ${err}` } })
    }
  }

  function providerKeys(pid) {
    const ring = loadRing()
    const entry = (ring.providers && ring.providers[pid]) || { keys: [], current: 0 }
    return entry
  }

  function currentKey(pid) {
    const entry = providerKeys(pid)
    if (Array.isArray(entry.keys) && entry.keys.length > 0) {
      const idx = Math.min(Math.max(entry.current || 0, 0), entry.keys.length - 1)
      return entry.keys[idx]
    }
    return process.env[ENV_MAP[pid]]
  }

  function rotate(pid, reason) {
    const ring = loadRing()
    const entry = (ring.providers && ring.providers[pid]) || { keys: [], current: 0 }
    if (!Array.isArray(entry.keys) || entry.keys.length < 2) {
      client.app.log({
        body: {
          service: "rotate-keys",
          level: "warn",
          message: `rotation requested for ${pid} (${reason}) but fewer than 2 keys in ring. Add keys to ${stateFile} or set ${ENV_MAP[pid]}.`
        }
      })
      return false
    }
    entry.current = ((entry.current || 0) + 1) % entry.keys.length
    if (!ring.providers) ring.providers = {}
    ring.providers[pid] = entry
    saveRing(ring)
    client.app.log({
      body: {
        service: "rotate-keys",
        level: "info",
        message: `rotated ${pid} to key index ${entry.current} (${reason})`
      }
    })
    return true
  }

  const FAILURE_RE = /429|401|403|rate.?limit|quota|insufficient|billing|authentication|invalid api|api key|forbidden/i

  // Last provider that actually issued a request (fallback for error events
  // that don't mention the provider name).
  let lastProvider = null

  return {
    config: async (cfg) => {
      for (const pid of Object.keys(ENV_MAP)) {
        const prov = cfg.provider && cfg.provider[pid]
        if (!prov) continue
        const key = currentKey(pid)
        if (key) {
          prov.options = prov.options || {}
          prov.options.apiKey = key
        }
      }
    },
    "chat.headers": async (input, output) => {
      const pid = input.model && input.model.providerID ? input.model.providerID : null
      if (!pid) return
      lastProvider = pid
      const key = currentKey(pid)
      if (!key) return
      if (pid === "google") {
        output.headers = output.headers || {}
        output.headers[HEADER_MAP.google] = key
      } else if (BEARER_PROVIDERS.includes(pid)) {
        output.headers = output.headers || {}
        output.headers[HEADER_MAP._bearer] = `Bearer ${key}`
      }
    },
    event: async ({ event }) => {
      const haystack = []
      const props = event.properties || {}
      if (event.type === "session.error" || event.type === "message.part.updated") {
        haystack.push(String(props.error || ""))
        if (typeof props.message === "string") haystack.push(props.message)
      }
      const joined = haystack.join(" ")
      if (!joined) return
      if (!FAILURE_RE.test(joined)) return
      // Which provider? Prefer the last one that sent a request, then fall
      // back to any provider name mentioned in the error payload.
      const mentioned =
        (joined.match(/(google|provocative|groq|nvidia|openrouter2?)/i) || [])[1]?.toLowerCase()
      const pidGuess = (props.providerID && String(props.providerID)) ||
        (props.model && String(props.model).split("/")[0]) ||
        (mentioned && ENV_MAP[mentioned] ? mentioned : null) ||
        (lastProvider && ENV_MAP[lastProvider] ? lastProvider : null)
      if (pidGuess && ENV_MAP[pidGuess]) rotate(pidGuess, event.type)
    }
  }
}