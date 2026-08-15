import { useState, useRef, useEffect } from 'react';
import { Download, FileJson, FileText, Table } from 'lucide-react';
import type { Topic } from '../../types';
import { exportToJson, exportToMarkdown, exportToCsv } from '../../lib/exporters';
import { cn } from '../../lib/utils';

interface ExportMenuProps {
  topics: Topic[];
}

export function ExportMenu({ topics }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (topics.length === 0) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors border",
          isOpen 
            ? "bg-slate-100 border-slate-300 text-slate-800" 
            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800"
        )}
      >
        <Download className="w-4 h-4" />
        Export
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 flex flex-col">
          <button
            onClick={() => { exportToMarkdown(topics); setIsOpen(false); }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Markdown (.md)
          </button>
          <button
            onClick={() => { exportToJson(topics); setIsOpen(false); }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
          >
            <FileJson className="w-4 h-4" />
            JSON Document
          </button>
          <button
            onClick={() => { exportToCsv(topics); setIsOpen(false); }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
          >
            <Table className="w-4 h-4" />
            Spreadsheet (.csv)
          </button>
        </div>
      )}
    </div>
  );
}
