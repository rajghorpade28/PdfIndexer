import { useState, useEffect, useRef } from 'react';
import { FileUploader } from './features/uploader/FileUploader';
import { IndexPanel } from './features/index-panel/IndexPanel';
import { PDFViewer } from './features/pdf-viewer/PDFViewer';
import { ExportMenu } from './features/export/ExportMenu';
import type { Topic, ProcessingProgress } from './types';
import './lib/pdf-setup';
import { extractTitlesForEmbedding, groupTopicsSemantically, cosineSimilarity } from './lib/clustering';

interface SearchResult {
  topic: Topic;
  score: number;
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [progress, setProgress] = useState<ProcessingProgress>({ status: 'idle', progress: 0, message: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [aiModelReady, setAiModelReady] = useState(false);
  
  // Search State
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  // Search state managed partly by ref
  const searchTimeoutRef = useRef<number | null>(null);

  const pdfWorkerRef = useRef<Worker | null>(null);
  const aiWorkerRef = useRef<Worker | null>(null);
  const pendingTopicsRef = useRef<Topic[]>([]);
  const currentSearchQueryRef = useRef<string>('');

  useEffect(() => {
    // Initialize Web Workers
    pdfWorkerRef.current = new Worker(new URL('./workers/pdf-extractor.worker.ts', import.meta.url), {
      type: 'module'
    });
    aiWorkerRef.current = new Worker(new URL('./workers/ai.worker.ts', import.meta.url), {
      type: 'module'
    });

    aiWorkerRef.current.postMessage({ type: 'INIT' });

    pdfWorkerRef.current.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'PROGRESS') {
        setProgress({ status: 'extracting', progress: payload.progress, message: payload.message });
      } else if (type === 'EXTRACT_SUCCESS') {
        pendingTopicsRef.current = payload.topics;
        
        if (aiModelReady && pendingTopicsRef.current.length > 0) {
           startSemanticGrouping(pendingTopicsRef.current);
        } else if (!aiModelReady) {
           setProgress({ status: 'loading', progress: 100, message: 'Waiting for AI engine to initialize...' });
        } else {
           setTopics([]);
           setProgress({ status: 'done', progress: 100, message: 'Processing complete' });
        }
      } else if (type === 'EXTRACT_ERROR') {
        setProgress({ status: 'error', progress: 0, message: payload });
      }
    };

    aiWorkerRef.current.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'DOWNLOAD_PROGRESS') {
         setProgress(prev => {
            // Only update main progress bar if user has uploaded a file and is waiting
            if (prev.status === 'idle' || prev.status === 'done' || prev.status === 'error') {
               return prev;
            }
            return {
              ...prev, 
              status: 'analyzing', 
              progress: payload.progress || 0, 
              message: `Downloading AI model: ${payload.file} (${Math.round(payload.progress)}%)` 
            };
         });
      } else if (type === 'INIT_SUCCESS') {
        setAiModelReady(true);
        if (pendingTopicsRef.current.length > 0) {
          startSemanticGrouping(pendingTopicsRef.current);
        }
      } else if (type === 'EMBED_PROGRESS') {
         // only update if not searching
         if (!isSearching) {
            setProgress({ status: 'analyzing', progress: payload.progress, message: 'Analyzing topic semantics...' });
         }
      } else if (type === 'EMBED_SUCCESS') {
         const { embeddings } = payload;
         
         if (currentSearchQueryRef.current !== '') {
            // It's a search embedding
            handleSearchEmbeddingsReturned(embeddings[0]);
         } else {
            // It's a clustering embedding
            setProgress({ status: 'analyzing', progress: 95, message: 'Clustering topics...' });
            const finalTopics = groupTopicsSemantically(pendingTopicsRef.current, embeddings);
            setTopics(finalTopics);
            setProgress({ status: 'done', progress: 100, message: 'Processing complete' });
            pendingTopicsRef.current = [];
         }
      } else if (type === 'INIT_ERROR' || type === 'EMBED_ERROR') {
         console.warn("AI Model failed: ", payload);
         if (currentSearchQueryRef.current !== '') {
            setIsSearching(false);
         } else if (pendingTopicsRef.current.length > 0) {
           setTopics(pendingTopicsRef.current);
           setProgress({ status: 'done', progress: 100, message: 'Processing complete (Basic Mode)' });
           pendingTopicsRef.current = [];
         }
      }
    };

    return () => {
      pdfWorkerRef.current?.terminate();
      aiWorkerRef.current?.terminate();
    };
  }, [aiModelReady, progress.status, isSearching]);

  // Use a second useEffect for topics so handleSearchEmbeddingsReturned has latest topics
  // A ref is better for avoiding dependency cycles
  const topicsRef = useRef(topics);
  useEffect(() => {
     topicsRef.current = topics;
  }, [topics]);

  const handleSearchEmbeddingsReturned = (queryEmbedding: number[]) => {
      const results: SearchResult[] = [];
      const threshold = 0.4; // minimum similarity to show

      function traverseAndScore(topicList: Topic[]) {
         topicList.forEach(topic => {
            if (topic.embedding) {
               const score = cosineSimilarity(queryEmbedding, topic.embedding);
               if (score > threshold) {
                  results.push({ topic, score });
               }
            }
            if (topic.children) {
               traverseAndScore(topic.children);
            }
         });
      }

      traverseAndScore(topicsRef.current);
      
      // Sort by score descending
      results.sort((a, b) => b.score - a.score);
      setSearchResults(results.slice(0, 15)); // top 15 matches
      setIsSearching(false);
      currentSearchQueryRef.current = '';
  };

  const startSemanticGrouping = (rootTopics: Topic[]) => {
    setProgress({ status: 'analyzing', progress: 0, message: 'Extracting semantic signatures...' });
    const titles = extractTitlesForEmbedding(rootTopics);
    
    if (titles.length === 0) {
      setTopics([]);
      setProgress({ status: 'done', progress: 100, message: 'Processing complete' });
      return;
    }

    aiWorkerRef.current?.postMessage({
      type: 'EMBED',
      payload: { texts: titles }
    });
  };

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setCurrentPage(1);
    setTopics([]);
    setSearchResults(null);
    setProgress({ status: 'loading', progress: 0, message: 'Reading file...' });

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      setProgress({ status: 'extracting', progress: 0, message: 'Starting extraction...' });
      
      pdfWorkerRef.current?.postMessage({
        type: 'EXTRACT',
        payload: { fileBuffer: arrayBuffer }
      });
    } catch (error: any) {
      setProgress({ status: 'error', progress: 0, message: 'Failed to read file: ' + error.message });
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = (query: string) => {
    if (!query.trim()) {
       setSearchResults(null);
       setIsSearching(false);
       currentSearchQueryRef.current = '';
       if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
       return;
    }

    // Debounce the search
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    searchTimeoutRef.current = window.setTimeout(() => {
       setIsSearching(true);
       currentSearchQueryRef.current = query;
       aiWorkerRef.current?.postMessage({
          type: 'EMBED',
          payload: { texts: [query] }
       });
    }, 500); // 500ms debounce
  };

  const handleRenameTopic = (id: string, newTitle: string) => {
      setTopics(prev => {
         // Deep clone strategy is safer but recursion is fine for small trees
         const deepRename = (tList: Topic[]): Topic[] => {
            return tList.map(t => {
               if (t.id === id) {
                  return { ...t, title: newTitle };
               }
               if (t.children && t.children.length > 0) {
                  return { ...t, children: deepRename(t.children) };
               }
               return t;
            });
         };
         return deepRename(prev);
      });
  };

  const handleDeleteTopic = (id: string) => {
      setTopics(prev => {
         const deepDelete = (tList: Topic[]): Topic[] => {
            return tList.filter(t => t.id !== id).map(t => {
               if (t.children && t.children.length > 0) {
                  return { ...t, children: deepDelete(t.children) };
               }
               return t;
            });
         };
         return deepDelete(prev);
      });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 shadow-sm z-20">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-inner">
            <span className="text-white font-bold text-sm">PI</span>
          </div>
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">PDF Indexer</h1>
        </div>
        <div className="flex items-center gap-4">
          {!aiModelReady && <span className="text-xs text-amber-600 font-medium flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> Initializing AI Engine</span>}
          {aiModelReady && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> AI Ready</span>}
          <div className="text-xs text-slate-500 font-medium px-3 py-1 bg-slate-100 rounded-full hidden sm:block">
            Private Local Processing
          </div>
          <ExportMenu topics={topics} />
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col relative">
        {!file && progress.status === 'idle' && (
          <div className="flex-1 flex items-center justify-center p-6">
            <FileUploader onFileSelect={handleFileSelect} />
          </div>
        )}

        {(progress.status === 'loading' || progress.status === 'extracting' || progress.status === 'analyzing') && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50">
            <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl text-center border border-slate-100">
              <div className="mb-6 relative">
                <div className="w-16 h-16 mx-auto border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Analyzing PDF Locally</h3>
              <p className="text-slate-500 mb-6 h-6 truncate" title={progress.message}>{progress.message}</p>
              
              <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${progress.progress}%` }}
                ></div>
              </div>
              <div className="text-xs text-slate-400 font-medium text-right">
                {Math.round(progress.progress)}%
              </div>
            </div>
          </div>
        )}

        {progress.status === 'error' && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center p-8 bg-red-50 text-red-700 rounded-xl max-w-md">
              <h3 className="font-bold mb-2 text-lg">Processing Failed</h3>
              <p className="text-sm mb-4">{progress.message}</p>
              <button 
                onClick={() => {
                  setProgress({ status: 'idle', progress: 0, message: '' });
                  setFile(null);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {progress.status === 'done' && file && (
          <div className="flex-1 flex overflow-hidden">
            <div className="w-80 border-r border-slate-200 bg-white flex flex-col shrink-0 shadow-sm z-10">
              <IndexPanel 
                topics={topics} 
                onTopicClick={handlePageChange} 
                activePage={currentPage} 
                onSearch={handleSearch}
                searchResults={searchResults}
                isSearching={isSearching}
                onRenameTopic={handleRenameTopic}
                onDeleteTopic={handleDeleteTopic}
              />
            </div>
            <div className="flex-1 flex flex-col min-w-0 bg-slate-50 p-4">
              <PDFViewer 
                file={file} 
                currentPage={currentPage} 
                onPageChange={handlePageChange} 
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
