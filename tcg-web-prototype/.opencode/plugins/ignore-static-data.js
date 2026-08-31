// ignore-static-data.js
// SOFT guidance hook for large static data files (card DBs, decks, batch
// inputs, snapshots). Nothing is ever blocked — full reads, greps, globs and
// listings all proceed. The hook only emits a non-blocking console warning so
// an agent reading these files is reminded to prefer bounded access (node -e
// filters, grep with a specific pattern, offset/limit reads) when a full dump
// is not necessary (context/token protection).
//
// Guidance that always applies is documented in AGENTS.md ("Static data
// protection"); this hook adds a runtime reminder without stopping tools.
export const IgnoreStaticData = async ({ client }) => {
  // Path patterns that are large when dumped wholesale.
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

  const warn = (msg) => {
    try {
      console.warn(`[static-data-guide] ${msg}`)
    } catch (_) {
      /* never let a warning break a tool call */
    }
  }

  return {
    "tool.execute.before": async (input, output) => {
      const { tool } = input
      if (!["read", "grep", "glob", "list"].includes(tool)) return
      const args = output && output.args ? output.args : {}
      if (!args) return

      if (tool === "list") {
        const pathArg = args.path || args.filePath || ""
        if (pathArg && isStaticDir(pathArg)) {
          warn(
            `listing ${pathArg} is a large static-data directory; ` +
              `consider a targeted node -e filter or grep pattern.`
          )
        }
        return
      }

      if (tool === "glob") {
        const pat = args.pattern || ""
        if (pat && isStaticGlob(pat)) {
          warn(
            `glob "${pat}" may match large static data files; ` +
              `prefer a precise pattern or a node -e filter.`
          )
        }
        return
      }

      if (tool === "grep") {
        const pathArg = args.path || args.include || ""
        if (pathArg && isStaticPath(pathArg)) {
          warn(
            `greping ${pathArg} (large static data file); ` +
              `search the whole project or use node -e with a filter if the dump risk is high.`
          )
        }
        return
      }

      const filePath = args.filePath || ""
      if (!isStaticPath(filePath)) return
      if (args.offset != null || args.limit != null) return
      warn(
        `full read of ${filePath} (large static data file, context protection); ` +
          `allowed, but prefer bounded access (node -e filter, grep pattern, ` +
          `offset/limit) unless the entire file is actually needed.`
      )
    }
  }
}