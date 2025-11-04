// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ✅ Полный фикс для Firebase (Auth + Firestore + Storage) на Vercel
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
      "firebase/functions",
      "firebase/analytics",
      "firebase/messaging"
    ],
  },
  build: {
    rollupOptions: {
      // 👇 добавляем все модули Firebase, чтобы Rollup не жаловался
      external: [
        "firebase",
        "firebase/app",
        "firebase/auth",
        "firebase/firestore",
        "firebase/storage",
        "firebase/functions",
        "firebase/analytics",
        "firebase/messaging"
      ],
    },
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
