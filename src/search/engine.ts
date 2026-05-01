import MiniSearch from 'minisearch';
import type { DocSection } from '../indexer/parse.js';

export class SearchEngine {
  private miniSearch: MiniSearch<DocSection>;
  private sectionMap: Map<string, DocSection>;

  constructor(sections: DocSection[]) {
    this.miniSearch = new MiniSearch<DocSection>({
      idField: 'id',
      fields: ['title', 'content'],
      storeFields: [
        'id',
        'page',
        'title',
        'content',
        'codeExamples',
        'url',
        'headingLevel',
        'parent',
      ],
      searchOptions: {
        boost: { title: 2 },
        fuzzy: 0.2,
        prefix: true,
      },
    });
    this.miniSearch.addAll(sections);
    this.sectionMap = new Map(sections.map((s) => [s.id, s]));
  }

  search(query: string, options: { limit?: number; page?: string } = {}): DocSection[] {
    const { limit = 10, page } = options;
    const results = this.miniSearch.search(query);
    const filtered = page ? results.filter((r) => r['page'] === page) : results;
    return filtered.slice(0, limit).map((r) => ({
      id: r['id'] as string,
      page: r['page'] as string,
      title: r['title'] as string,
      content: r['content'] as string,
      codeExamples: r['codeExamples'] as string[],
      url: r['url'] as string,
      headingLevel: r['headingLevel'] as number,
      parent: r['parent'] as string | undefined,
    }));
  }

  getById(id: string): DocSection | undefined {
    return this.sectionMap.get(id);
  }

  listSections(page?: string): DocSection[] {
    const all = Array.from(this.sectionMap.values());
    return page ? all.filter((s) => s.page === page) : all;
  }

  get sectionCount(): number {
    return this.sectionMap.size;
  }
}
