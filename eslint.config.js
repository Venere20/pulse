// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/**", ".feature-build/**"],
  },
  {
    files: ["scripts/**/*.cjs", "scripts/**/*.js"],
    languageOptions: {
      globals: { __dirname: "readonly", require: "readonly", module: "readonly", process: "readonly", console: "readonly", Buffer: "readonly", Response: "readonly", Request: "readonly", AbortSignal: "readonly" },
    },
  }
  ,{
    files: ["public/sw.js"],
    languageOptions: { globals: { clients: "readonly" } },
  },
  {
    files: ["supabase/functions/**/*.ts"],
    // Deno resolves HTTPS imports remotely; the Node resolver cannot inspect them.
    rules: { "import/no-unresolved": ["error", { ignore: ["^https://"] }] },
  }
]);
