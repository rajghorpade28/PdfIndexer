import { pipeline, env } from '@xenova/transformers';

// Skip local model check and strictly use the cached or remote huggingface model
env.allowLocalModels = false;
// Use IndexedDB for caching model weights
env.useBrowserCache = true;

let embedder: any = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    try {
      if (!embedder) {
        embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
          progress_callback: (progress: any) => {
            // progress: { status: 'downloading'|'progress'|'done', file: string, progress: number }
            self.postMessage({ type: 'DOWNLOAD_PROGRESS', payload: progress });
          }
        });
      }
      self.postMessage({ type: 'INIT_SUCCESS' });
    } catch (error: any) {
      self.postMessage({ type: 'INIT_ERROR', payload: error.message });
    }
  } else if (type === 'EMBED') {
    try {
      const { texts } = payload;
      // We process in small batches to not lock the worker entirely
      const embeddings = [];
      
      for (let i = 0; i < texts.length; i++) {
        // Generate embedding
        const output = await embedder(texts[i], { pooling: 'mean', normalize: true });
        // output.data is a Float32Array of the embedding (384 dims for all-MiniLM)
        embeddings.push(Array.from(output.data));
        
        self.postMessage({ type: 'EMBED_PROGRESS', payload: { progress: ((i + 1) / texts.length) * 100 } });
      }

      self.postMessage({ type: 'EMBED_SUCCESS', payload: { embeddings } });
    } catch (error: any) {
      self.postMessage({ type: 'EMBED_ERROR', payload: error.message });
    }
  }
};
