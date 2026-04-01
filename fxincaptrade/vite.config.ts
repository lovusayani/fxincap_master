import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/** Dev proxy target when the browser uses same-origin `/api` (VITE_API_URL unset in the client). */
const apiTarget = process.env.VITE_API_URL || "http://localhost:7000";

export default defineConfig(() => ({
  server: {
    host: "0.0.0.0",
    port: parseInt(process.env.PORT || "3000"),
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  css: {
    postcss: "./postcss.config.js",
  },
  build: {
    outDir: "dist/spa",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split(".");
          const ext = info[info.length - 1];
          if (/png|jpe?g|gif|svg|webp|ttf|eot|woff|woff2|csv|xlsx?|xls|docx?|pptx?|zip|gz|bz2/.test(ext)) {
            return `assets/[name]-[hash][extname]`;
          } else if (ext === "css") {
            return `assets/style-[hash].css`;
          }
          return `assets/[name]-[hash][extname]`;
        },
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
    dedupe: ["react", "react-dom"],
  },
  ssr: {
    noExternal: [],
    external: ["metaapi.cloud-sdk"],
  },
  optimizeDeps: {
    exclude: ["metaapi.cloud-sdk"],
  },
}));
