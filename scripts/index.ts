import { join } from 'node:path';
import {
  fetchLatestCommitSha,
  fetchDocMarkdown,
  cacheRawDoc,
  DOC_PAGES,
} from '../src/indexer/fetch.js';
import { parsePage } from '../src/indexer/parse.js';
import { writePageIndex, writeMeta } from '../src/indexer/store.js';

const DATA_DIR = join(process.cwd(), 'data');

async function main() {
  console.log('Checking latest commit SHA...');
  const sha = await fetchLatestCommitSha();
  console.log(`SHA: ${sha ?? 'unavailable (continuing anyway)'}`);

  const rawDir = join(DATA_DIR, 'raw');
  let totalSections = 0;

  for (const page of DOC_PAGES) {
    process.stdout.write(`Fetching ${page}.md... `);
    const markdown = await fetchDocMarkdown(page);
    await cacheRawDoc(rawDir, page, markdown);

    const sections = parsePage(page, markdown);
    await writePageIndex(DATA_DIR, page, sections);
    totalSections += sections.length;
    console.log(`${sections.length} sections`);
  }

  await writeMeta(DATA_DIR, {
    lastCommitSha: sha ?? 'unknown',
    lastIndexedAt: new Date().toISOString(),
  });

  console.log(`\nDone! ${totalSections} sections across ${DOC_PAGES.length} pages.`);
}

main().catch((err) => {
  console.error('Indexing failed:', err);
  process.exit(1);
});
