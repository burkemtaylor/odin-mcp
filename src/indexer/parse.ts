export interface DocSection {
  id: string;
  page: string;
  title: string;
  content: string;
  codeExamples: string[];
  url: string;
  headingLevel: number;
  parent?: string;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function extractCodeBlocks(text: string): string[] {
  const blocks: string[] = [];
  const regex = /```(?:[^\n]*)?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const code = match[1].trim();
    if (code) blocks.push(code);
  }
  return blocks;
}

function stripFrontmatter(content: string): { title: string; body: string } {
  if (!content.startsWith('---')) return { title: '', body: content };
  const end = content.indexOf('\n---', 3);
  if (end === -1) return { title: '', body: content };

  const fm = content.slice(3, end);
  const titleMatch = fm.match(/^title:\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim().replace(/^["']|["']$/g, '') : '';
  return { title, body: content.slice(end + 4).trimStart() };
}

export function parsePage(page: string, content: string): DocSection[] {
  const { title: pageTitle, body } = stripFrontmatter(content);
  const lines = body.split('\n');
  const sections: DocSection[] = [];
  const seenSlugs = new Set<string>();
  const parentStack: Array<{ level: number; id: string }> = [];

  let currentLevel = 0;
  let currentTitle = '';
  let currentLines: string[] = [];
  let inSection = false;

  const getUniqueSlug = (title: string): string => {
    const base = slugify(title);
    if (!seenSlugs.has(base)) {
      seenSlugs.add(base);
      return base;
    }
    let i = 2;
    while (seenSlugs.has(`${base}-${i}`)) i++;
    const unique = `${base}-${i}`;
    seenSlugs.add(unique);
    return unique;
  };

  const saveSection = () => {
    if (!inSection) return;
    const sectionContent = currentLines.join('\n').trim();
    const slug = getUniqueSlug(currentTitle);
    const id = `${page}/${slug}`;

    // Pop stack entries at same or deeper level to find true parent
    while (parentStack.length > 0 && parentStack[parentStack.length - 1].level >= currentLevel) {
      parentStack.pop();
    }
    const parentId = parentStack.length > 0 ? parentStack[parentStack.length - 1].id : undefined;

    sections.push({
      id,
      page,
      title: currentTitle,
      content: sectionContent,
      codeExamples: extractCodeBlocks(sectionContent),
      url: `https://odin-lang.org/docs/${page}/#${slug}`,
      headingLevel: currentLevel,
      parent: parentId,
    });

    parentStack.push({ level: currentLevel, id });
    inSection = false;
  };

  for (const line of lines) {
    // Match ## or ### headings (not #### or deeper)
    const headingMatch = line.match(/^(#{2,3})\s+(.+)$/);
    if (headingMatch) {
      saveSection();
      currentLevel = headingMatch[1].length;
      currentTitle = headingMatch[2].trim();
      currentLines = [];
      inSection = true;
    } else if (inSection) {
      currentLines.push(line);
    }
  }
  saveSection();

  // Fallback for pages with no ##/### headings (e.g. demo.md)
  if (sections.length === 0 && body.trim()) {
    const title = pageTitle || page;
    const slug = slugify(title);
    sections.push({
      id: `${page}/${slug}`,
      page,
      title,
      content: body.trim(),
      codeExamples: extractCodeBlocks(body),
      url: `https://odin-lang.org/docs/${page}/`,
      headingLevel: 1,
    });
  }

  return sections;
}
