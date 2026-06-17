import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    server: {
      deps: {
        inline: ["server-only"]
      }
    },
    alias: {
      "server-only": "node_modules/server-only/empty.js"
    }
  },
});
