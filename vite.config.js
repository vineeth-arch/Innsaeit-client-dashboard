import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite builds the SPA to dist/. The /api directory is handled by Vercel's
// serverless runtime, not Vite. For local dev with the functions, use
// `npx vercel dev` (see README); `npm run dev` runs the UI only.
export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
});
