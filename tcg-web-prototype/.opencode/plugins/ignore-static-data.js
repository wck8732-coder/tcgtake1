// ignore-static-data.js
// Blocks agents from reading large static data files (card DBs, decks, batch
// inputs, snapshots) to protect session context. Targeted access still works:
//  - user message explicitly names the file (edit intent) => allowed
//  - bounded partial reads (offset/limit)                  => allowed
//  - grep/glob/list not pointed directly at these files    => allowed
// Blocked full reads are surfaced with guidance (use grep / node -e / edit).
export const IgnoreStaticData = async ({ client }) => {
  // Path patterns that must not be dumped into context wholesale.
  const STATIC_PATTERNS = [
    /(^|[\\/])card_database(\.master|\.backup|\.tentative)?\.json$/i,
    /(^|[\\/])cards_full(\.master|\.backup|\.tentative)?\.json$/i,
    /(^|[\\/])cards\.json$/i,
    /(^|[\\/])decks\.json$/i,
    /(^|[\\/])tcgtake1[\\/]/,
    /(^|[\\/])backups[\\/]/,
    /(^|[\\/])unity[\\/]Assets[\\/]StreamingAssets[\\/]/,
    /\.csv$/i
  ]
  const GLOB_PATTERNS = [
    /cards(\*|\.|_).*\.json$/i,
    /decks.*\.json$/i,
    /\.csv$/i
  ]
  const STATIC_DIRS = [
    /(^|[\\/])tcgtake1([\\/]|$)/,
    /(^|[\\/])backups([\\/]|$)/,
    /(^|[\\/])unity[\\/]Assets[\\/]StreamingAssets([\\/]|$)/,
    /(^|[\\/])state([\\/]|$)/,
    /(^|[\\/])node_modules([\\/]|$)/
  ]

  const isStaticPath = (p) => STATIC_PATTERNS.some((re) => re.test(p || ""))
  const isStaticGlob = (p) => GLOB_PATTERNS.some((re) => re.test(p || ""))
  const isStaticDir = (p) => STATIC_DIRS.some((re) => re.test(p || ""))

  // Cache of the most recent user text per session (refresh on demand).
  const userTextCache = new Map() // sessionID -> { text, at }

  async function latestUserText(sessionID) {
    const hit = userTextCache.get(sessionID)
    if (hit && Date.now() - hit.at < 3000) return hit.text
    try {
      const res = await client.session.messages({ path: { id: sessionID } })
      const list = Array.isArray(res) ? res : (res && (res.data || res.messages)) || []
      let text = ""
      for (let i = list.length - 1; i >= 0; i--) {
        const msg = list[i]
        if (msg && msg.info && msg.info.role === "user") {
          text = (msg.parts || []).map((p) => (p && p.text) || "").join(" ")
          break
        }
      }
      userTextCache.set(sessionID, { text, at: Date.now() })
      return text
    } catch (err) {
      return ""
    }
  }

  return {
    "tool.execute.before": async (input, output) => {
      const { tool, sessionID } = input
      if (!["read", "grep", "glob", "list"].includes(tool)) return
      const args = output && output.args ? output.args : {}
      if (!args) return

      // Directory listings inside static trees are never useful.
      if (tool === "list") {
        const pathArg = args.path || args.filePath || ""
        if (pathArg && isStaticDir(pathArg)) {
          throw new Error(
            `Blocked listing ${pathArg}: directory contains large static data. ` +
              `Use targeted tools (grep with a specific pattern) or node -e filters instead.`
          )
        }
        return
      }

      if (tool === "glob") {
        const pat = args.pattern || ""
        if (pat && isStaticGlob(pat)) {
          throw new Error(
            `Blocked glob "${pat}": matches large static data files. ` +
              `Use a precise pattern (e.g. a specific file) or node -e instead.`
          )
        }
        return
      }

      if (tool === "grep") {
        const pathArg = args.path || args.include || ""
        if (pathArg && isStaticPath(pathArg)) {
          const filename = pathArg.split(/[\\/]/).pop()
          const userText = await latestUserText(sessionID)
          if (userText && userText.toLowerCase().includes(filename.toLowerCase())) return
          throw new Error(
            `Blocked grep in ${pathArg}: large static data file. ` +
              `Search the whole project (no path) or use node -e with a filter. ` +
              `If you are editing this file, mention "${filename}" in your request.`
          )
        }
        return
      }

      // tool === "read"
      const filePath = args.filePath || ""
      if (!isStaticPath(filePath)) return
      // Bounded partial reads are allowed (protects context).
      if (args.offset != null || args.limit != null) return
      const filename = filePath.split(/[\\/]/).pop()
      const userText = await latestUserText(sessionID)
      if (userText && userText.toLowerCase().includes(filename.toLowerCase())) return
      throw new Error(
        `Blocked reading ${filePath}: large static data file (context protection). ` +
          `To inspect: use grep with a specific pattern, or node -e with a filter, ` +
          `or read with an offset/limit. To edit this file, mention "${filename}" in your request.`
      )
    }
  }
}