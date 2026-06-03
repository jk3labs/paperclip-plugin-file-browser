import { definePlugin } from "@paperclipai/plugin-sdk";
import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';

const plugin = definePlugin({
  id: 'jkl-file-browser',
  name: 'File Browser',
  register: (context) => {
    console.debug('[File Browser Plugin] Registering plugin');
    const router = express.Router();
    const rootDir = context.environment.rootDir;

    // Validate rootDir exists
    console.debug(`[File Browser Plugin] Root directory: ${rootDir}`);
    if (!rootDir || !(fs.existsSync(rootDir))) {
      console.error(`[File Browser Plugin] Invalid root directory: ${rootDir}`);
      throw new Error(`Invalid root directory: ${rootDir}`);
    }

    router.get('/list', async (req, res) => {
      try {
        const relativePath = req.query.path as string || '';
        const targetPath = path.join(rootDir, relativePath);

        // Security: Ensure targetPath is within rootDir
        if (!targetPath.startsWith(rootDir)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        const entries = await fs.readdir(targetPath, { withFileTypes: true });
        const files = entries
          .filter(dirent => dirent.isFile())
          .map(dirent => dirent.name);
        const directories = entries
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);

        res.json({
          files,
          directories,
          currentPath: path.relative(rootDir, targetPath),
          rootDir
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const statusCode = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 404 : 500;
        res.status(statusCode).json({ error: message });
      }
    });

    router.get('/download', async (req, res) => {
      try {
        const relativePath = req.query.path as string;
        if (!relativePath) {
          return res.status(400).json({ error: 'Path parameter is required' });
        }

        const targetPath = path.join(rootDir, relativePath);

        // Security: Ensure targetPath is within rootDir
        if (!targetPath.startsWith(rootDir)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        // Check if path exists and is a file
        const stats = await fs.stat(targetPath);
        if (!stats.isFile()) {
          return res.status(404).json({ error: 'File not found' });
        }

        // Stream file for download
        res.download(targetPath, path.basename(targetPath));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const statusCode = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 404 : 500;
        res.status(statusCode).json({ error: message });
      }
    });

    router.get('/zip', async (req, res) => {
      try {
        const relativePath = req.query.path as string;
        if (!relativePath) {
          return res.status(400).json({ error: 'Path parameter is required' });
        }

        const targetPath = path.join(rootDir, relativePath);

        // Security: Ensure targetPath is within rootDir
        if (!targetPath.startsWith(rootDir)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        // Check if path exists and is a directory
        const stats = await fs.stat(targetPath);
        if (!stats.isDirectory()) {
          return res.status(404).json({ error: 'Directory not found' });
        }

        // Set headers for ZIP download
        res.attachment(`${path.basename(targetPath)}.zip`);

        // Create ZIP stream
        const archive = archiver('zip', {
          zlib: { level: 9 } // Maximum compression
        });

        archive.pipe(res);
        archive.directory(targetPath, false);
        await archive.finalize();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const statusCode = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 404 : 500;
        res.status(statusCode).json({ error: message });
      }
    });

    context.addRouter('/files', router);
  },
});

export default plugin;