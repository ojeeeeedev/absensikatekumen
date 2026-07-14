import js from "@eslint/js";
import globals from "globals";

const sharedBrowserGlobals = {
  STATIC_TOPICS: "readonly",
  Html5Qrcode: "readonly",
  createProfilePhotoUploader: "readonly",
  createSearchCombobox: "readonly",
  getCookie: "readonly",
  handleScan: "readonly",
  initTheme: "readonly",
  openTopicSelector: "readonly",
  scanQueue: "readonly",
  selectTopic: "readonly",
  setAppState: "readonly",
  showStudentModal: "readonly",
  showToast: "readonly",
};

export default [
  {
    ignores: ["node_modules/**", "storybook-static/**"],
  },
  js.configs.recommended,
  {
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["app.js", "middleware.js", "api/**/*.js"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "no-unused-vars": ["error", { caughtErrors: "none" }],
    },
  },
  {
    files: ["test/**/*.js"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // ponytail: mocks can be consumed indirectly; enable after tests use typed mock helpers.
      "no-unused-vars": "off",
    },
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...sharedBrowserGlobals },
    },
    rules: {
      "no-unused-vars": "off",
    },
  },
  {
    files: ["public/**/*.js"],
    languageOptions: {
      globals: { ...globals.browser, ...sharedBrowserGlobals },
    },
    rules: {
      // ponytail: legacy scripts share globals; enable after they become modules.
      "no-unused-vars": "off",
    },
  },
];
