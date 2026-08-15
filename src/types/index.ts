export interface Topic {
  id: string;
  title: string;
  level: number;
  startPage: number;
  endPage?: number;
  embedding?: number[];
  children: Topic[];
}

export interface ExtractedPage {
  pageNumber: number;
  textItems: TextItem[];
}

export interface TextItem {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
  hasEOL: boolean;
  fontSize: number;
  fontWeight: number;
}

export interface ProcessingProgress {
  status: 'idle' | 'loading' | 'extracting' | 'analyzing' | 'done' | 'error';
  progress: number; // 0 to 100
  message: string;
}
