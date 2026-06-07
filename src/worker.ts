import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { PluginApiRequestInput, PluginApiResponse, PluginContext } from "@paperclipai/plugin-sdk";
import os from 'os';
import fs from 'fs-extra';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const _require = createRequire(import.meta.url);
const archiverModule = _require('archiver');

function getArchiver() {
  if (typeof archiverModule === 'function') return archiverModule;
  if (archiverModule && typeof archiverModule.default === 'function') return archiverModule.default;
  if (archiverModule && typeof archiverModule.ZipArchive === 'function') {
    return (format: string, options: any) => new archiverModule.ZipArchive(options);
  }
  if (archiverModule?.default?.default && typeof archiverModule.default.default === 'function') {
    return archiverModule.default.default;
  }
  return archiverModule;
}

let pluginCtx: PluginContext | null = null;
const getFallbackRootDir = () => {
  const home = os.homedir();
  const pathsToTry = [
    path.join(home, '.paperclip', 'instances', 'default'),
    path.join(home, 'instances', 'default'),
    '/paperclip/instances/default',
    home
  ];
  
  for (const p of pathsToTry) {
    if (fs.existsSync(p)) return p;
  }
  return pathsToTry[0];
};

const DEFAULT_ROOT_DIR = process.env["PAPERCLIP_DEFAULT_WORKSPACE"] || getFallbackRootDir();

let INSTANCE_DIR: string | null = null;
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // 1. Try standard instance path detection
  let match = __dirname.match(/(.*[\\/]instances[\\/][^\\/]+)/i);
  
  // 2. Try Docker sibling detection (if in .paperclip/plugins, look for ../../instances/default)
  if (!match && __dirname.toLowerCase().includes('.paperclip' + path.sep + 'plugins')) {
    const base = __dirname.split(path.sep + '.paperclip' + path.sep + 'plugins')[0];
    const dockerInstance = path.join(base, 'instances', 'default');
    if (fs.existsSync(dockerInstance)) {
      INSTANCE_DIR = dockerInstance;
    }
  }

  // 3. Last resort fallback to plugins parent
  if (!match && !INSTANCE_DIR) {
    match = __dirname.match(/(.*)[\\/]plugins[\\/]/i);
    if (match) INSTANCE_DIR = path.normalize(match[1]);
  } else if (match) {
    INSTANCE_DIR = path.normalize(match[1]);
  }
} catch (e) {}

function isAllowed(targetPath: string, rootDir: string): boolean {
  const normTarget = path.normalize(targetPath).toLowerCase();
  const normRoot = path.normalize(rootDir).toLowerCase();
  return normTarget.startsWith(normRoot);
}

async function resolveRootDir(
  companyId?: string | null,
  projectId?: string | null,
  entityId?: string | null,
  entityType?: string | null
): Promise<string> {
  if (pluginCtx && companyId) {
    try {
      const timeout = new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Workspace resolution timeout")), 2000));
      
      const getWorkspace = async () => {
        if (entityType === "project" && entityId) {
          const workspace = await pluginCtx!.projects.getPrimaryWorkspace(entityId, companyId);
          if (workspace?.path) return workspace.path;
        } else if (entityType === "issue" && entityId) {
          const workspace = await pluginCtx!.projects.getWorkspaceForIssue(entityId, companyId);
          if (workspace?.path) return workspace.path;
        } else if (projectId) {
          const workspace = await pluginCtx!.projects.getPrimaryWorkspace(projectId, companyId);
          if (workspace?.path) return workspace.path;
        }
        return null;
      };

      const pathResult = await Promise.race([getWorkspace(), timeout]);
      if (pathResult) return pathResult;
    } catch (err) {
      if (pluginCtx) pluginCtx.logger.error(`Error or timeout resolving workspace path: ${err}`);
    }
  }
  return INSTANCE_DIR || DEFAULT_ROOT_DIR;
}

async function handleList(input: PluginApiRequestInput): Promise<PluginApiResponse> {
  try {
    const companyId = (input.query.companyId as string) || input.companyId;
    const projectId = input.query.projectId as string;
    const entityId = input.query.entityId as string;
    const entityType = input.query.entityType as string;

    const rootDir = await resolveRootDir(companyId, projectId, entityId, entityType);
    const relativePath = (input.query.path as string) || "";
    const targetPath = path.join(rootDir, relativePath);
    
    if (!isAllowed(targetPath, rootDir)) return { status: 403, body: { error: "Access denied" } };
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    return {
      body: {
        files: entries.filter(e => e.isFile()).map(e => e.name),
        directories: entries.filter(e => e.isDirectory()).map(e => e.name),
        currentPath: path.relative(rootDir, targetPath),
        rootDir: rootDir,
      },
    };
  } catch (error: any) {
    const code = error?.code === "ENOENT" ? 404 : 500;
    return { status: code, body: { error: error?.message || String(error) } };
  }
}

async function handleDownload(input: PluginApiRequestInput): Promise<PluginApiResponse> {
  try {
    const relativePath = (input.query.path as string) || "";
    if (!relativePath) return { status: 400, body: { error: "Path parameter is required" } };

    const companyId = (input.query.companyId as string) || input.companyId;
    const projectId = input.query.projectId as string;
    const entityId = input.query.entityId as string;
    const entityType = input.query.entityType as string;

    const rootDir = await resolveRootDir(companyId, projectId, entityId, entityType);
    const targetPath = path.join(rootDir, relativePath);

    if (!isAllowed(targetPath, rootDir)) return { status: 403, body: { error: "Access denied" } };
    const stats = await fs.stat(targetPath);
    if (!stats.isFile()) return { status: 404, body: { error: "File not found" } };
    
    const content = await fs.readFile(targetPath);
    return {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${path.basename(targetPath)}"`,
      },
      body: content.toString("base64"),
    };
  } catch (error: any) {
    const code = error?.code === "ENOENT" ? 404 : 500;
    return { status: code, body: { error: error?.message || String(error) } };
  }
}

async function handleZip(input: PluginApiRequestInput): Promise<PluginApiResponse> {
  try {
    const relativePath = (input.query.path as string) || "";

    const companyId = (input.query.companyId as string) || input.companyId;
    const projectId = input.query.projectId as string;
    const entityId = input.query.entityId as string;
    const entityType = input.query.entityType as string;

    const rootDir = await resolveRootDir(companyId, projectId, entityId, entityType);
    const targetPath = path.join(rootDir, relativePath);

    if (!isAllowed(targetPath, rootDir)) return { status: 403, body: { error: "Access denied" } };
    const stats = await fs.stat(targetPath);
    if (!stats.isDirectory()) return { status: 404, body: { error: "Directory not found" } };
    
    const archiver = getArchiver();
    if (typeof archiver !== 'function') {
      throw new Error(`Archiver module failed to initialize. Type: ${typeof archiver}`);
    }

    const archive = archiver("zip", { zlib: { level: 9 } });
    const buffers: Buffer[] = [];
    archive.on("data", (d: Buffer) => buffers.push(d));
    const finished = new Promise<void>((resolve, reject) => {
      archive.on("end", () => resolve());
      archive.on("error", (e: Error) => reject(e));
    });
    archive.directory(targetPath, false);
    await archive.finalize();
    await finished;
    
    return {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${path.basename(targetPath) || 'root'}.zip"`,
      },
      body: Buffer.concat(buffers).toString("base64"),
    };
  } catch (error: any) {
    if (pluginCtx) pluginCtx.logger.error(`Error in handleZip: ${error.message}`);
    return { status: 500, body: { error: error?.message || String(error) } };
  }
}

const plugin = definePlugin({
  async setup(ctx) {
    pluginCtx = ctx;
    ctx.logger.info("File Browser Plugin started");
    
    ctx.data.register("list-files", async (params) => {
      try {
        const companyId = params?.companyId as string;
        const projectId = params?.projectId as string;
        const entityId = params?.entityId as string;
        const entityType = params?.entityType as string;
        const relativePath = (params?.path as string) || "";

        const rootDir = await resolveRootDir(companyId, projectId, entityId, entityType);
        const targetPath = path.join(rootDir, relativePath);

        if (!isAllowed(targetPath, rootDir)) throw new Error("Access denied");
        const entries = await fs.readdir(targetPath, { withFileTypes: true });
        return {
          files: entries.filter(e => e.isFile()).map(e => e.name),
          directories: entries.filter(e => e.isDirectory()).map(e => e.name),
          currentPath: path.relative(rootDir, targetPath),
          rootDir: rootDir,
        };
      } catch (e: any) {
        if (ctx) ctx.logger.error(`Error in list-files handler: ${e.message}`);
        throw e;
      }
    });

    // New data provider for file content preview
    ctx.data.register("get-file-content", async (params) => {
      try {
        const companyId = params?.companyId as string;
        const projectId = params?.projectId as string;
        const entityId = params?.entityId as string;
        const entityType = params?.entityType as string;
        const relativePath = (params?.path as string) || "";

        if (!relativePath) throw new Error("Path parameter is required");

        const rootDir = await resolveRootDir(companyId, projectId, entityId, entityType);
        const targetPath = path.join(rootDir, relativePath);

        if (!isAllowed(targetPath, rootDir)) throw new Error("Access denied");
        const stats = await fs.stat(targetPath);
        if (!stats.isFile()) throw new Error("File not found");

        const ext = path.extname(targetPath).toLowerCase();
        const isBinary = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.pdf'].includes(ext);

        if (isBinary) {
          const content = await fs.readFile(targetPath);
          return { content: content.toString("base64"), isBinary: true, ext };
        } else {
          const content = await fs.readFile(targetPath, 'utf8');
          return { content, isBinary: false, ext };
        }
      } catch (e: any) {
        if (ctx) ctx.logger.error(`Error in get-file-content handler: ${e.message}`);
        throw e;
      }
    });
  },
  async onHealth() {
    return { status: "ok", message: "File Browser Plugin is running" };
  },
  async onApiRequest(input: PluginApiRequestInput): Promise<PluginApiResponse> {
    const { routeKey, method } = input;
    if (method !== "GET") return { status: 405, body: { error: "Method not allowed" } };
    switch (routeKey) {
      case "list-files": return handleList(input);
      case "download-file": return handleDownload(input);
      case "download-zip": return handleZip(input);
      default: return { status: 404, body: { error: "Not found" } };
    }
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
