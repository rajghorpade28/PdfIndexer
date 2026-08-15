import React, { useState, useCallback } from 'react';
import { UploadCloud, File as FileIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
}

export function FileUploader({ onFileSelect }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        onFileSelect(file);
      } else {
        alert('Please upload a valid PDF file.');
      }
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        onFileSelect(file);
      }
    }
  }, [onFileSelect]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl mb-4">
          PDF Indexer
        </h1>
        <p className="text-lg text-slate-600">
          Turn any PDF into a smart, clickable index.
        </p>
        <p className="text-sm text-slate-500 font-medium mt-2">
          Private. Local. No uploads.
        </p>
      </div>

      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer bg-white transition-all duration-200",
          isDragging ? "border-blue-500 bg-blue-50 scale-105 shadow-xl" : "border-slate-300 hover:bg-slate-50 hover:border-slate-400 shadow-sm"
        )}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <UploadCloud className={cn("w-12 h-12 mb-4", isDragging ? "text-blue-500" : "text-slate-400")} />
          <p className="mb-2 text-lg font-semibold text-slate-700">
            Drop your PDF here
          </p>
          <p className="text-sm text-slate-500">or click to browse</p>
        </div>
        <input type="file" className="hidden" accept="application/pdf" onChange={handleFileInput} />
      </label>
      
      <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-500">
        <FileIcon className="w-4 h-4" />
        <span>Supports large files directly in your browser.</span>
      </div>
    </div>
  );
}
