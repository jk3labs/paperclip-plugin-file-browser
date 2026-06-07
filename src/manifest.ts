import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const PLUGIN_ID = "paperclip-plugin-file-browser";
const PLUGIN_VERSION = "0.4.31";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "File Browser",
  description: "A plugin to browse files in the Paperclip default workspace.",
  author: "JK3 Labs",
  categories: ["workspace"],
  capabilities: [
    "events.subscribe",
    "plugin.state.read",
    "plugin.state.write",
    "local.folders",
    "ui.dashboardWidget.register",
    "ui.detailTab.register",
    "ui.sidebar.register",
    "api.routes.register",
    "project.workspaces.read",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  localFolders: [
    {
      folderKey: "workspace",
      displayName: "Workspace Root",
      description: "Root directory of the project workspace to browse files",
      access: "read"
    }
  ],
  apiRoutes: [
    {
      routeKey: "list-files",
      method: "GET",
      path: "/files/list",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" }
    },
    {
      routeKey: "download-file",
      method: "GET",
      path: "/files/download",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" }
    },
    {
      routeKey: "download-zip",
      method: "GET",
      path: "/files/zip",
      auth: "board-or-agent",
      capability: "api.routes.register",
      companyResolution: { from: "query", key: "companyId" }
    }
  ],
  ui: {
    slots: [
      {
        type: "dashboardWidget",
        id: "file-browser-widget",
        displayName: "File Browser",
        exportName: "DashboardWidget"
      },
      {
        type: "detailTab",
        id: "file-browser-tab",
        displayName: "Files",
        exportName: "FileBrowserTab",
        entityTypes: ["project", "issue"],
        order: 50
      }
    ]
  }
};

export default manifest;