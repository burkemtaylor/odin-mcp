# Odin MCP — Implementation Plan

Local MCP server that indexes Odin language docs from GitHub and exposes structured lookup tools.

---

## Dependencies

- `@modelcontextprotocol/sdk` — MCP server protocol
- `minisearch` — full-text search with fuzzy matching and relevance scoring
- `typescript`, `tsx` — build and run

No HTML parser needed. Docs are raw Markdown in the [`odin-lang/odin-lang.org`](https://github.com/odin-lang/odin-lang.org) repo under `content/docs/`.

## Project Structure

```
odin-mcp/
├── src/
│   ├── server.ts          # MCP server entry, stdio transport
│   ├── indexer/
│   │   ├── fetch.ts       # Pull Markdown from GitHub, staleness check
│   │   ├── parse.ts       # Markdown → DocSection[]
│   │   └── store.ts       # Read/write JSON index + meta to disk
│   ├── search/
│   │   └── engine.ts      # MiniSearch wrapper
│   └── tools/
│       ├── lookup.ts      # odin-lookup
│       ├── search.ts      # odin-search
│       ├── list.ts        # odin-list-sections
│       ├── get.ts         # odin-get-section
│       └── reindex.ts     # odin-reindex
├── data/                  # Generated at runtime, gitignored
│   ├── raw/               # Cached .md files from GitHub
│   ├── index/             # Parsed JSON per doc page
│   └── meta.json          # Commit SHA + timestamp
├── scripts/
│   └── index.ts           # CLI entrypoint: `npx tsx scripts/index.ts`
├── package.json
└── tsconfig.json
```

## Doc Sources

Fetched from GitHub raw content URLs:
```
https://raw.githubusercontent.com/odin-lang/odin-lang.org/master/content/docs/<file>.md
```

| File | Parse Strategy |
|------|---------------|
| `overview.md` | Split on `##`/`###`. Largest file — full language reference. |
| `faq.md` | Split on question headings. ~70 Q&A pairs. |
| `install.md` | Split on `##`/`###`. Small. |
| `testing.md` | Split on `##`/`###`. Small-medium. |
| `examples.md` | Split on `##`/`###`. Code-heavy. |
| `demo.md` | Split on `##`/`###`. Single-file demo. |
| `nightly.md` | Split on `##`/`###`. Small. |
| `packages.md` | Index as single section (it's a directory listing). |

Skip `_index.md` (Hugo index) and `odin-book.md` (external link).

No Hugo shortcodes in any doc files — pure Markdown throughout.

## Index Schema

```typescript
interface DocSection {
  id: string;              // "overview/variable-declarations"
  page: string;            // "overview"
  title: string;           // "Variable Declarations"
  content: string;         // Markdown text of section
  codeExamples: string[];  // Extracted fenced code blocks
  url: string;             // "https://odin-lang.org/docs/overview/#variable-declarations"
  headingLevel: number;    // 2 for ##, 3 for ###
  parent?: string;         // Parent section ID
}
```

### Parsing Rules
- Split file on lines matching `/^#{2,3}\s/`
- Extract fenced code blocks with `/```[\s\S]*?```/g`
- Slugify headings for IDs: `"Variable Declarations"` → `"variable-declarations"`
- Construct URL: `https://odin-lang.org/docs/<page>/#<slug>`
- Track parent by maintaining a stack of heading levels during parsing

## Staleness Detection

On server startup, check the latest commit SHA for the docs directory:
```
GET https://api.github.com/repos/odin-lang/odin-lang.org/commits?path=content/docs&per_page=1
```

Compare against `data/meta.json`:
```typescript
interface IndexMeta {
  lastCommitSha: string;
  lastIndexedAt: string;   // ISO 8601
}
```

- **SHA matches** → load cached index from `data/index/`
- **SHA differs or no meta file** → re-fetch all Markdown, re-parse, re-index
- **GitHub API fails** (rate limit, offline) → load cached index, log warning

## Search Engine

MiniSearch configuration:
- Index fields: `title`, `content`
- Store all `DocSection` fields
- Boost: `title` 2x over `content`
- Fuzzy matching: tolerance 1
- Prefix search: enabled

Load all `data/index/*.json` on startup, build MiniSearch index in memory.

## MCP Tools

### `odin-lookup`
Look up a specific topic in Odin docs.
```
Params:  query: string, page?: string, limit?: number (default 5)
Returns: Array<{ title, content, codeExamples, url }>
```

### `odin-search`
Full-text search across all indexed docs.
```
Params:  query: string, limit?: number (default 10)
Returns: Array<{ title, content, url, score }>
```

### `odin-list-sections`
List all indexed sections for discovery.
```
Params:  page?: string
Returns: Array<{ id, title, page, url }>
```

### `odin-get-section`
Get a section by exact ID.
```
Params:  id: string (e.g. "overview/variable-declarations")
Returns: DocSection
```

### `odin-reindex`
Force re-index from GitHub regardless of staleness.
```
Params:  none
Returns: { sectionsIndexed, pagesIndexed, commitSha }
```

## Server Config

stdio transport. Add to Claude Code MCP config:
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

## Build Order

1. **Scaffold** — package.json, tsconfig.json, install deps
2. **Fetcher** — GitHub raw URL fetching, local caching to `data/raw/`, meta.json with commit SHA
3. **Parser** — Markdown splitting + code block extraction. Build against `overview.md` first (most complex).
4. **Store** — Write `DocSection[]` to `data/index/<page>.json`, read on startup
5. **Staleness** — GitHub API SHA check, auto-reindex logic on startup
6. **Search** — MiniSearch wrapper over loaded index
7. **MCP server** — stdio server, register all 5 tools
8. **Test** — Index all pages, start server, query from Claude Code
9. **Remaining pages** — Ensure all 8 doc files parse correctly

---

## Phase 2: Embeddings (Future)

Add semantic search for intent-based queries (e.g. "how do I free memory" → allocator docs).

- **Model**: `all-MiniLM-L6-v2` via `@xenova/transformers` — runs in Node, no external service
- **Storage**: Brute-force cosine similarity over Float32Arrays in JSON (~600-800KB for the full corpus)
- **New tool**: `odin-semantic-search` — embed query, compare against section embeddings, return top-k
- **Enhancement**: Add `mode?: "keyword" | "semantic" | "hybrid"` to `odin-lookup`
