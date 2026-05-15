import { join } from 'node:path';
import { fetchLatestCommitSha, DOC_PAGES } from '../src/indexer/fetch.js';
import { runIndexPipeline } from '../src/indexer/pipeline.js';

const DATA_DIR = join(process.cwd(), 'data');

async function main() {
  console.log('Checking latest commit SHA...');
  const sha = await fetchLatestCommitSha();
  console.log(`SHA: ${sha ?? 'unavailable (continuing anyway)'}`);

  console.log(`Fetching and indexing ${DOC_PAGES.length} pages in parallel...`);
  const { totalSections } = await runIndexPipeline(DATA_DIR, sha);

  console.log(`\nDone! ${totalSections} sections across ${DOC_PAGES.length} pages.`);
}

main().catch((err) => {
  console.error('Indexing failed:', err);
  process.exit(1);
});
