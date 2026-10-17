import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  base: "/academic-lens-lk/",
  define: { "import.meta.env.VITE_DATA_REVISION": JSON.stringify(String(Date.now())) },
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      ignored: [
        "**/Data files/**",
        "**/Ethics Approval/**",
        "**/docs/**",
        "**/output/**",
        "**/test-results/**",
        "**/tests/**",
      ],
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    testTimeout: 20000,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["echarts"],
          vendor: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
