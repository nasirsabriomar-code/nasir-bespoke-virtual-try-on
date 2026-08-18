@AGENTS.md

## graphify (default navigation mode)

`graphify-out/graph.json` is a prebuilt knowledge graph of this repo (modules, symbols, call/import edges, communities). Before broad exploration, use it:

- **Check freshness first:** compare `git rev-parse HEAD` to the "Built from commit" line in `graphify-out/GRAPH_REPORT.md`. If it matches (or is a trivial ancestor), trust the graph. Do not rebuild/regenerate it just to be safe.
- **Locate before reading:** use `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` (or read `graphify-out/graph.json` / `GRAPH_REPORT.md` directly) to find relevant modules, symbols, callers/callees, and affected files — before opening source files.
- **Avoid broad scans:** skip recursive directory reads and wide Glob/Grep sweeps when the graph already identifies the relevant code.
- **Read minimally:** after the graph narrows the target, open only the specific files/symbols needed.
- **Fall back freely:** if the graph is stale, incomplete, or doesn't answer the question, fall back to normal exploration (grep/read) without hesitation — the graph optimizes navigation, it never blocks reading whatever is needed to implement or verify a change correctly.
- **After substantial code changes:** decide whether the graph needs updating (`graphify update .`, AST-only, no API cost) — not required for trivial edits.
