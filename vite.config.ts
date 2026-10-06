import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, "index.html"),
        nhst: resolve(__dirname, "nhst/index.html"),
        regression: resolve(__dirname, "regression/index.html"),
      },
    },
  },
});
