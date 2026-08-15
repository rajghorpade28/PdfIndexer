import type { Topic } from '../types';

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// 1. JSON Export
export function exportToJson(topics: Topic[]) {
  // We should strip the embeddings before exporting to save massive space
  const cleanTopics = (tList: Topic[]): any[] => {
     return tList.map(t => {
        const { embedding, ...rest } = t;
        return {
           ...rest,
           children: t.children ? cleanTopics(t.children) : []
        };
     });
  };
  
  const content = JSON.stringify({ index: cleanTopics(topics), exportedAt: new Date().toISOString() }, null, 2);
  triggerDownload(content, 'pdf-index.json', 'application/json');
}

// 2. Markdown Export
export function exportToMarkdown(topics: Topic[]) {
  let content = '# PDF Index\n\n';

  function traverse(tList: Topic[], depth: number) {
    tList.forEach(t => {
      // Create markdown heading level based on depth (max 6)
      const prefix = '#'.repeat(Math.min(depth + 1, 6));
      content += `${prefix} ${t.title} *(p. ${t.startPage}${t.endPage && t.endPage !== t.startPage ? `-${t.endPage}` : ''})*\n\n`;
      if (t.children && t.children.length > 0) {
        traverse(t.children, depth + 1);
      }
    });
  }

  traverse(topics, 1);
  triggerDownload(content, 'pdf-index.md', 'text/markdown');
}

// 3. CSV Export
export function exportToCsv(topics: Topic[]) {
  let content = 'Level,Title,StartPage,EndPage\n';

  function traverse(tList: Topic[]) {
    tList.forEach(t => {
      // Escape commas in titles
      const escapedTitle = `"${t.title.replace(/"/g, '""')}"`;
      content += `${t.level},${escapedTitle},${t.startPage},${t.endPage || t.startPage}\n`;
      if (t.children && t.children.length > 0) {
        traverse(t.children);
      }
    });
  }

  traverse(topics);
  triggerDownload(content, 'pdf-index.csv', 'text/csv');
}
