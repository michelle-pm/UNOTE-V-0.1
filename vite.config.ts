import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      "firebase/app",
      "firebase/auth",
      "firebase/firestore",
      "firebase/storage",
    ],
  },
  build: {
    rollupOptions: {
      external: [],
    },
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  resolve: {
    alias: {
      "@firebase/app": "firebase/app",
      "@firebase/auth": "firebase/auth",
      "@firebase/firestore": "firebase/firestore",
      "@firebase/storage": "firebase/storage",
    },
  },
});
