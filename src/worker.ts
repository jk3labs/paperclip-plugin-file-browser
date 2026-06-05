import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { PluginApiRequestInput, PluginApiResponse, PluginContext } from "@paperclipai/plugin-sdk";
import fs from 'fs-extra';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const _require = createRequire(import.meta.url);
const archiverModule = _require('archiver');

let pluginCtx: PluginContext | null = null;
const DEFAULT_ROOT_DIR = process.env["PAPERCLIP_DEFAULT_WORKSPACE"] || process.cwd();

let INSTANCE_DIR: string | null = null;
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const match = __dirname.match(/(.*[\\/]instances[\\/][^\\/]+)/i);
  if (match) {
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
    
    // DEFENSIVE INITIALIZATION
    let archive: any;
    const options = { zlib: { level: 9 } };

    if (typeof archiverModule === 'function') {
      archive = archiverModule("zip", options);
    } else if (archiverModule && typeof archiverModule.default === 'function') {
      archive = archiverModule.default("zip", options);
    } else if (archiverModule && typeof archiverModule.ZipArchive === 'function') {
      // Use ZipArchive class directly if factory is missing (avoids registry errors)
      archive = new archiverModule.ZipArchive(options);
    } else if (archiverModule && typeof archiverModule.Archiver === 'function') {
      // Last resort: manually initialize Archiver if factory is broken
      archive = new archiverModule.Archiver("zip", options);
    } else {
      throw new Error(`Unsupported archiver module structure. Type: ${typeof archiverModule}`);
    }

    if (!archive || typeof archive.on !== 'function') {
      throw new Error("Failed to create archive instance or instance is not an event emitter");
    }

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
    ctx.logger.info(`Default root directory: ${DEFAULT_ROOT_DIR}`);
    if (INSTANCE_DIR) {
      ctx.logger.info(`Resolved instance directory: ${INSTANCE_DIR}`);
    }

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
