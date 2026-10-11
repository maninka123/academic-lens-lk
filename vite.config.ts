import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  base: "/academic-lens-lk/",
  plugins: [react(), tailwindcss()],
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
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
