import { join } from 'node:path';
import { fetchDocMarkdown, cacheRawDoc, DOC_PAGES } from './fetch.js';
import { parsePage, type DocSection } from './parse.js';
import { writePageIndex, writeMeta } from './store.js';

export interface PipelineResult {
  sections: DocSection[];
  totalSections: number;
}

export async function runIndexPipeline(
  dataDir: string,
  sha: string | null
): Promise<PipelineResult> {
  const rawDir = join(dataDir, 'raw');
  const allSections: DocSection[] = [];

  await Promise.all(
    DOC_PAGES.map(async (page) => {
      const markdown = await fetchDocMarkdown(page);
      await cacheRawDoc(rawDir, page, markdown);
      const sections = parsePage(page, markdown);
      await writePageIndex(dataDir, page, sections);
      allSections.push(...sections);
    })
  );

  await writeMeta(dataDir, {
    lastCommitSha: sha ?? 'unknown',
    lastIndexedAt: new Date().toISOString(),
  });

  return { sections: allSections, totalSections: allSections.length };
}
