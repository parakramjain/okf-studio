import tseslint from "typescript-eslint";
export default tseslint.config(
  {
    ignores: [
      "out/**",
      "dist/**",
      "node_modules/**",
      ".cache/**",
      "OKF_Knowledge_Studio_Build_Prompts/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mjs}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);
