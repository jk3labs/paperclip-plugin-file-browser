import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const PLUGIN_ID = "jkl-file-browser";
const PLUGIN_VERSION = "0.4.3";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "File Browser",
  description: "A plugin to browse files in the Paperclip default workspace.",
  author: "JKL",
  categories: ["workspace"],
  capabilities: [],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
};

export default manifest;