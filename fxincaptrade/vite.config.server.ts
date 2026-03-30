import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  build: {
    ssr: "server/start.ts",
    outDir: "dist/server",
    rollupOptions: {
      output: {
        entryFileNames: "start.js",
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  ssr: {
    external: ["metaapi.cloud-sdk", "express", "cors", "mysql2"],
  },
});
