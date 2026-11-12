import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig keeps JSX as "preserve" for Next; tests that render .tsx need the
  // automatic runtime so components don't depend on a global React.
  esbuild: { jsx: "automatic" },
  test: {
    passWithNoTests: true,
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
  },
});
