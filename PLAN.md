# Odin MCP — Local Odin Language Docs Server

## Goal
A local MCP server that indexes odin-lang.org/docs once and exposes fast, structured lookup tools for use in Claude Code (or any MCP client).

---

## Phase 1: Structured JSON Index + Full-Text Search

### 1. Project Scaffold
- TypeScript, Node.js
- `@modelcontextprotocol/sdk` — official MCP server SDK, no alternative
- `minisearch` — lightweight full-text search with fuzzy matching, TF-IDF scoring, and prefix search (~8KB). Earns its place over bare string matching because the LLM won't always use exact Odin terminology. Optional — can start without and add if simple matching feels limiting.
- No HTML parser needed (see §4)
- Minimal deps — no database, no build step beyond tsc

```
odin-mcp/
├── src/
│   ├── server.ts              # MCP server entry, stdio transport
│   ├── tools/
│   │   ├── lookup.ts          # lookup(query, section?, limit?)
│   │   ├── list-sections.ts   # list all indexed sections/pages
│   │   └── search.ts          # full-text search across all docs
│   ├── indexer/
│   │   ├── fetch.ts           # Clone/pull raw Markdown from GitHub repo
│   │   ├── parse.ts           # Markdown → structured sections
│   │   └── store.ts           # Write/read JSON index files
│   └── search/
│       └── engine.ts          # MiniSearch wrapper, index loading
├── data/
│   └── index/                 # Generated: one JSON per doc page
│       ├── overview.json
│       ├── faq.json
│       ├── install.json
│       ├── testing.json
│       ├── examples.json
│       └── demo.json
├── scripts/
│   └── index.ts               # CLI: `npx tsx scripts/index.ts` to rebuild
├── package.json
├── tsconfig.json
└── PLAN.md
```

### 2. Doc Source

Odin's docs are **Markdown files in a Hugo site**: [`odin-lang/odin-lang.org`](https://github.com/odin-lang/odin-lang.org) on GitHub.

The raw source lives at `content/docs/`:

| File | Notes |
|------|-------|
| `overview.md` | Largest file. Full language reference — split by `##`/`###` headings |
| `faq.md` | ~70 Q&A pairs — split by question headings |
| `install.md` | Small, single section |
| `testing.md` | Small-medium |
| `examples.md` | Code-heavy |
| `demo.md` | Single-file demo |
| `nightly.md` | Small — nightly build info |
| `packages.md` | Directory of package docs — index as metadata only for v1 |
| `odin-book.md` | External link to book — skip or index as a pointer |
| `_index.md` | Hugo index page — skip |

**Fetch strategy**: Use GitHub raw content URLs to pull each Markdown file directly. No git clone needed.
```
https://raw.githubusercontent.com/odin-lang/odin-lang.org/master/content/docs/overview.md
```
Cache raw Markdown files locally in `data/raw/` so we can re-parse without re-fetching.

**Staleness detection**: On server startup, check the latest commit SHA for `content/docs/` via the GitHub API:
```
GET https://api.github.com/repos/odin-lang/odin-lang.org/commits?path=content/docs&per_page=1
```
Compare against a stored SHA in `data/meta.json`. If different (or no meta file exists), re-index automatically. If same, load cached index. This keeps the server self-maintaining — no manual re-indexing needed under normal use.

```typescript
// data/meta.json
{
  "lastCommitSha": "abc123...",
  "lastIndexedAt": "2026-05-01T12:00:00Z"
}
```

### 3. Index Schema

Each doc page gets parsed into an array of sections:

```typescript
interface DocSection {
  id: string;              // e.g. "overview/variable-declarations"
  page: string;            // e.g. "overview"
  title: string;           // e.g. "Variable Declarations"
  content: string;         // Full text content of section (Markdown preserved)
  codeExamples: string[];  // Extracted fenced code blocks
  url: string;             // Full URL to section anchor on odin-lang.org
  headingLevel: number;    // 2 for ##, 3 for ###, etc.
  parent?: string;         // Parent section ID for hierarchy
}
```

### 4. Indexer Flow

```
scripts/index.ts
  → For each doc file:
      → Fetch raw Markdown from GitHub (or read from data/raw/ cache)
      → Save raw file to data/raw/<page>.md
      → Split on heading lines (## and ###)
      → For each section:
          → Extract title from heading
          → Extract body text
          → Extract fenced code blocks (``` ... ```)
          → Generate slug for ID and URL anchor
          → Build DocSection object
      → Write to data/index/<page>.json
```

Parsing is straightforward string splitting — no library needed:
- Split file content on lines matching `/^#{2,3}\s/`
- Extract code blocks with `/```[\s\S]*?```/g`
- Slugify headings for IDs: "Variable Declarations" → "variable-declarations"
- Construct URL: `https://odin-lang.org/docs/<page>/#<slug>`

### 5. Search Engine

MiniSearch configured with:
- Fields: `title`, `content`
- Stored fields: all of DocSection
- Boost `title` matches 2x over `content`
- Fuzzy matching (tolerance 1) with prefix search enabled

Load all index JSON files on server startup, build MiniSearch index in memory.

### 6. MCP Tools

#### `odin-lookup`
Look up a specific topic in Odin docs.
```
Params:
  query: string       — what to search for (e.g. "slices", "context system")
  page?: string       — limit to specific page (e.g. "overview", "faq")
  limit?: number      — max results, default 5

Returns:
  Array of { title, content, codeExamples, url }
```

#### `odin-search`
Full-text search across all indexed docs.
```
Params:
  query: string       — search query
  limit?: number      — max results, default 10

Returns:
  Array of { title, content, url, score }
```

#### `odin-list-sections`
List all available sections (useful for discovery).
```
Params:
  page?: string       — filter to specific page

Returns:
  Array of { id, title, page, url }
```

#### `odin-get-section`
Get a specific section by ID (exact retrieval after discovering via search).
```
Params:
  id: string          — section ID (e.g. "overview/variable-declarations")

Returns:
  Full DocSection object
```

#### `odin-reindex`
Force a re-index of all docs from GitHub, regardless of staleness.
```
Params:
  none

Returns:
  { sectionsIndexed: number, pagesIndexed: number, commitSha: string }
```
Useful when you know upstream docs changed and don't want to restart the server. Also serves as a fallback if the GitHub API check fails (e.g. rate limiting).

### 7. Server Setup

- stdio transport (standard for Claude Code MCP servers)
- On startup: check commit SHA via GitHub API → re-index if stale, load cache if current
- Register 5 tools
- Add to Claude Code MCP config:
  ```json
  {
    "mcpServers": {
      "odin-docs": {
        "command": "node",
        "args": ["dist/server.js"],
        "cwd": "/path/to/odin-mcp"
      }
    }
  }
  ```

### 8. Build Order

1. **Scaffold**: package.json, tsconfig, install `@modelcontextprotocol/sdk` + `minisearch`
2. **Fetcher**: Pull raw Markdown files from GitHub, cache to `data/raw/`, write `data/meta.json` with commit SHA
3. **Parser**: Parse `overview.md` first (most complex) — split on headings, extract code blocks
4. **Store**: Write parsed sections to `data/index/overview.json`
5. **Staleness check**: GitHub API commit SHA comparison, auto-reindex on startup if stale
6. **Search engine**: MiniSearch wrapper over index files
7. **MCP server + tools**: Wire up all 5 tools (lookup, search, list-sections, get-section, reindex)
8. **Test**: Run indexer, start server, query from Claude Code
9. **Remaining pages**: Add FAQ, install, testing, examples, demo, nightly

---

## Phase 2: Embeddings Upgrade (Future)

### Goal
Add semantic search alongside full-text search for fuzzier, intent-based queries (e.g. "how do I free memory" finds allocator docs).

### Approach

#### Embedding Model
- **`@xenova/transformers`** with `all-MiniLM-L6-v2` — runs in-process in Node, no external dependencies (no Ollama, no API keys)
- Alternative: Ollama + `nomic-embed-text` if you already run Ollama locally

#### Storage
- Brute-force cosine similarity over Float32Arrays stored in JSON
- Doc set is small (~300-500 sections) — no vector DB needed
- If it grows significantly, upgrade to SQLite + `sqlite-vec`

#### Index Schema Addition
```typescript
interface DocSectionWithEmbedding extends DocSection {
  embedding: number[];     // 384-dim vector
}
```

#### Indexing Flow Change
```
For each DocSection:
  → Concatenate title + content (truncate to model max tokens)
  → Generate embedding via transformers.js
  → Store embedding alongside section in index JSON
```

#### New/Modified Tools

**`odin-semantic-search`** (new)
```
Params:
  query: string
  limit?: number

Flow:
  → Embed the query string
  → Cosine similarity against all section embeddings
  → Return top-k results
```

**`odin-lookup`** (enhanced)
- Add `mode?: "keyword" | "semantic" | "hybrid"` param
- Hybrid: run both, merge and deduplicate results by section ID

#### Build Order
1. Add `@xenova/transformers` dep
2. Extend indexer to generate embeddings per section
3. Store embeddings in index JSON files (or separate `data/embeddings/` files)
4. Implement cosine similarity search
5. Add `odin-semantic-search` tool
6. Optionally enhance `odin-lookup` with hybrid mode

#### Size Estimates
- ~300-500 doc sections × 384 dims × 4 bytes = ~600KB-800KB for embeddings
- Model download: ~90MB (one-time, cached by transformers.js)
- Query latency: <100ms (brute-force cosine sim on this corpus size)

---

## Dependency Summary

| Dependency | Purpose | Justification |
|------------|---------|---------------|
| `@modelcontextprotocol/sdk` | MCP server protocol | Official SDK, only real option |
| `minisearch` | Full-text search | Fuzzy matching + scoring for ~8KB; LLM queries won't always use exact terms |
| `@xenova/transformers` (Phase 2) | Embedding generation | In-process, no external service needed |

Notably absent:
- ~~`cheerio`~~ — Not needed. Docs are raw Markdown on GitHub.
- No database — JSON files on disk, loaded into memory at startup.

---

## Open Questions
None currently.

## Resolved
- **Hugo shortcodes**: Audited — the two largest doc files (overview.md, faq.md) contain zero shortcodes. The only shortcodes in the repo are newsletter-related (newsletter-img, newsletter-video, newsletter-vimeo, newsletter-youtube) — presentational, not used in docs. No handling needed.
- **Packages page**: The `packages.md` file itself is just a directory listing. The concern was about indexing the individual package API docs it links to (core:fmt, core:os, etc.) — that's a large separate corpus. Not a blocker; it's a scope expansion for a future phase, not an open question for v1.
- **`--force` flag**: Not needed as a CLI flag. Staleness is handled automatically via GitHub commit SHA check on startup. For manual override, the `odin-reindex` MCP tool serves the same purpose without leaving the client.
