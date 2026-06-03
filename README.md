# Paperclip File Browser Plugin

A Paperclip plugin for browsing, downloading, and zipping files in the default workspace.

## Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/jk3labs/paperclip-plugin-file-browser.git
   cd paperclip-plugin-file-browser
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Compile the plugin:

   ```bash
   npx tsc
   ```

4. Install the plugin in Paperclip:

   ```bash
   paperclipai plugin install ./paperclip-plugin-file-browser
   ```

## API Endpoints

### 1. List Directory Contents

**Endpoint:** `GET /files/list`

**Query Parameters:**
- `path` (optional): Relative path to the directory (defaults to root).

**Response:**
```json
{
  "files": ["file1.txt", "file2.txt"],
  "directories": ["dir1", "dir2"],
  "currentPath": "relative/path",
  "rootDir": "/absolute/root/path"
}
```

**Errors:**
- `403 Forbidden`: Access denied (path outside root).
- `404 Not Found`: Directory does not exist.
- `500 Internal Server Error`: Server error.

### 2. Download File

**Endpoint:** `GET /files/download`

**Query Parameters:**
- `path` (required): Relative path to the file.

**Response:**
- Streams the file for download.

**Errors:**
- `400 Bad Request`: Path parameter missing.
- `403 Forbidden`: Access denied (path outside root).
- `404 Not Found`: File does not exist.
- `500 Internal Server Error`: Server error.

### 3. Download Directory as ZIP

**Endpoint:** `GET /files/zip`

**Query Parameters:**
- `path` (required): Relative path to the directory.

**Response:**
- Streams the directory as a ZIP file.

**Errors:**
- `400 Bad Request`: Path parameter missing.
- `403 Forbidden`: Access denied (path outside root).
- `404 Not Found`: Directory does not exist.
- `500 Internal Server Error`: Server error.

## Development

- Run `npx tsc --watch` to enable TypeScript watch mode.
- Reinstall the plugin after making changes.