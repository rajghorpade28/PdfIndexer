import * as pdfjs from 'pdfjs-dist';
import type { ExtractedPage, TextItem, Topic } from '../types';

import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

// Listen for messages from the main thread
self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'EXTRACT') {
    try {
      const { fileBuffer } = payload;
      const result = await processPDF(fileBuffer);
      self.postMessage({ type: 'EXTRACT_SUCCESS', payload: result });
    } catch (error: any) {
      self.postMessage({ type: 'EXTRACT_ERROR', payload: error.message || 'Unknown error' });
    }
  }
};

async function processPDF(fileBuffer: ArrayBuffer) {
  const loadingTask = pdfjs.getDocument({ data: fileBuffer });
  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;

  let allPages: ExtractedPage[] = [];

  // 1. Extract text and metrics from all pages
  for (let i = 1; i <= numPages; i++) {
    self.postMessage({ type: 'PROGRESS', payload: { progress: (i / numPages) * 50, message: `Extracting page ${i} of ${numPages}...` } });
    
    const page = await pdfDocument.getPage(i);
    const textContent = await page.getTextContent();
    
    const items: TextItem[] = textContent.items.map((item: any) => {
      const fontSize = Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]);
      const isBold = item.fontName ? item.fontName.toLowerCase().includes('bold') : false;
      const fontWeight = isBold ? 700 : 400;

      return {
        str: item.str,
        dir: item.dir,
        width: item.width,
        height: item.height,
        transform: item.transform,
        fontName: item.fontName,
        hasEOL: item.hasEOL,
        fontSize: fontSize,
        fontWeight: fontWeight
      };
    });

    allPages.push({ pageNumber: i, textItems: items });
  }

  // 2. Detect Headings and Build Hierarchy
  self.postMessage({ type: 'PROGRESS', payload: { progress: 60, message: 'Detecting headings...' } });
  const topics = buildTopics(allPages);

  self.postMessage({ type: 'PROGRESS', payload: { progress: 100, message: 'Done' } });

  return { pages: allPages, topics };
}

// Very basic heuristic for MVP:
// We look for text items that are larger than the most common font size (body text)
// Or items that are bold. We merge adjacent items on the same line.
function buildTopics(pages: ExtractedPage[]): Topic[] {
  // Step 2a: Find base font size (simplistic mode of font sizes)
  let sizeCounts: Record<number, number> = {};
  pages.forEach(p => {
    p.textItems.forEach(item => {
      if (item.str.trim() === '') return;
      const rounded = Math.round(item.fontSize);
      sizeCounts[rounded] = (sizeCounts[rounded] || 0) + 1;
    });
  });
  
  let baseFontSize = 10;
  let maxCount = 0;
  for (const [sizeStr, count] of Object.entries(sizeCounts)) {
    if (count > maxCount) {
      maxCount = count;
      baseFontSize = parseInt(sizeStr);
    }
  }

  // Step 2b: Find potential headings
  const headings: { title: string, page: number, fontSize: number, fontWeight: number, y: number }[] = [];

  pages.forEach(page => {
    let currentLineY = -1;
    let currentLineText = '';
    let currentLineMaxFontSize = 0;
    let currentLineMaxFontWeight = 400;

    const sortedItems = [...page.textItems].sort((a, b) => {
      const yA = Math.round(a.transform[5]);
      const yB = Math.round(b.transform[5]);
      if (yB !== yA) return yB - yA;
      return a.transform[4] - b.transform[4];
    });

    sortedItems.forEach(item => {
      const y = Math.round(item.transform[5]);
      const text = item.str.trim();
      if (!text) return;

      if (currentLineY === -1 || Math.abs(y - currentLineY) > 5) {
        if (currentLineText && (Math.round(currentLineMaxFontSize) > baseFontSize || currentLineMaxFontWeight >= 700)) {
          if (currentLineText.length < 100 && currentLineText.length > 2) {
             headings.push({
               title: currentLineText,
               page: page.pageNumber,
               fontSize: currentLineMaxFontSize,
               fontWeight: currentLineMaxFontWeight,
               y: currentLineY
             });
          }
        }
        currentLineY = y;
        currentLineText = text;
        currentLineMaxFontSize = item.fontSize;
        currentLineMaxFontWeight = item.fontWeight;
      } else {
        currentLineText += ' ' + text;
        currentLineMaxFontSize = Math.max(currentLineMaxFontSize, item.fontSize);
        currentLineMaxFontWeight = Math.max(currentLineMaxFontWeight, item.fontWeight);
      }
    });

    if (currentLineText && (Math.round(currentLineMaxFontSize) > baseFontSize || currentLineMaxFontWeight >= 700)) {
       if (currentLineText.length < 100 && currentLineText.length > 2) {
         headings.push({
           title: currentLineText,
           page: page.pageNumber,
           fontSize: currentLineMaxFontSize,
           fontWeight: currentLineMaxFontWeight,
           y: currentLineY
         });
       }
    }
  });

  const uniqueSizes = Array.from(new Set(headings.map(h => Math.round(h.fontSize)))).sort((a, b) => b - a);
  
  const rootTopics: Topic[] = [];
  const stack: { topic: Topic, fontSize: number }[] = [];

  let idCounter = 1;

  headings.forEach(h => {
    const roundedSize = Math.round(h.fontSize);
    const level = uniqueSizes.indexOf(roundedSize) || 0;

    const topic: Topic = {
      id: `topic-${idCounter++}`,
      title: h.title,
      level: level,
      startPage: h.page,
      children: []
    };

    while (stack.length > 0 && stack[stack.length - 1].fontSize <= roundedSize) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootTopics.push(topic);
    } else {
      stack[stack.length - 1].topic.children.push(topic);
    }

    stack.push({ topic, fontSize: roundedSize });
  });

  return rootTopics;
}
