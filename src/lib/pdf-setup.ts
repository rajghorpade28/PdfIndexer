import { pdfjs } from 'react-pdf';
// Import the worker directly from the local node_modules via Vite's URL import
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set the worker source to the locally bundled file instead of a CDN
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
