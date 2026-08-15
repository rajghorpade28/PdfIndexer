import { useState } from 'react';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

interface PDFViewerProps {
  file: File | null;
  currentPage: number;
  onPageChange: (pageNumber: number) => void;
}

export function PDFViewer({ file, currentPage, onPageChange }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState(1.0);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  if (!file) return null;

  return (
    <div className="flex flex-col h-full bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
      <div className="flex items-center justify-between p-2 bg-white border-b border-slate-200 shadow-sm z-10">
        <div className="flex items-center space-x-2">
          <button
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="p-1 rounded hover:bg-slate-100 disabled:opacity-50"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-slate-700">
            Page {currentPage} of {numPages || '--'}
          </span>
          <button
            disabled={numPages === null || currentPage >= numPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="p-1 rounded hover:bg-slate-100 disabled:opacity-50"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
            className="p-1 rounded hover:bg-slate-100"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-xs font-medium text-slate-500 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(s => Math.min(3.0, s + 0.1))}
            className="p-1 rounded hover:bg-slate-100"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-200 p-4 flex justify-center custom-scrollbar">
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center h-full text-slate-500">
              Loading PDF...
            </div>
          }
          className="shadow-xl"
        >
          <Page 
            pageNumber={currentPage} 
            scale={scale} 
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  );
}
