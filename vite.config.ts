// ⚠️ DO NOT EDIT: Fix for Vite + Firebase build on Vercel.
// ⚠️ Не редактировать — обеспечивает стабильную сборку Firebase на Vercel.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite build fix for Firebase modular SDK (auth/firestore/storage)
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom", "firebase"],
  },
  optimizeDeps: {
    include: [
      "firebase/app",
      "firebase/auth",
      "firebase/firestore",
      "firebase/storage",
    ],
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
  external: ["firebase", "firebase/auth", "firebase/firestore", "firebase/storage"],
},
  },
});
