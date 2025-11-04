import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
