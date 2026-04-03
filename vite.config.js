import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react({ fastRefresh: false })],
  server: {
    proxy: {
      "/api": {
        target: "https://signal-navy-five.vercel.app",
        changeOrigin: true,
      },
    },
  },
});
