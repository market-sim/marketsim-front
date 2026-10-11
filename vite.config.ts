import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // "@/..." = "src/..."
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173, // doit correspondre a app.cors.allowed-origins du backend
    strictPort: true,
  },
});
