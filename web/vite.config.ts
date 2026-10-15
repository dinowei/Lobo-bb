import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// "npm run build"      → site normal em dist/ (servido pelo Express)
// "npm run build:demo" → um único HTML com tudo embutido (modo demo, para publicar/compartilhar)
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "demo" ? [viteSingleFile()] : [])],
  build: { outDir: mode === "demo" ? "dist-demo" : "dist" },
  server: {
    fs: { allow: [".."] }, // permite importar ../shared e ../data
    proxy: { "/api": "http://localhost:3333" },
  },
}));
