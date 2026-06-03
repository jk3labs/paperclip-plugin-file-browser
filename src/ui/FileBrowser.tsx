import React, { useState, useEffect } from 'react';

interface FileBrowserProps {
  apiBaseUrl: string;
}

interface FileListResponse {
  files: string[];
  directories: string[];
  currentPath: string;
  rootDir: string;
}

const FileBrowser: React.FC<FileBrowserProps> = ({ apiBaseUrl }) => {
  const [files, setFiles] = useState<string[]>([]);
  const [directories, setDirectories] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    console.debug('[File Browser UI] Fetching file list');
    const fetchFiles = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/list?path=${encodeURIComponent(currentPath)}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch files');
        }
        const data: FileListResponse = await response.json();
        setFiles(data.files);
        setDirectories(data.directories);
        setCurrentPath(data.currentPath);
      } catch (err) {
        console.error('[File Browser UI] Error fetching files:', err);
        setError(err instanceof Error ? err.message : 'Failed to load files');
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [currentPath, apiBaseUrl]);

  const handleDirectoryClick = (dir: string) => {
    setCurrentPath(currentPath ? `${currentPath}/${dir}` : dir);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>File Browser: {error}</div>;
  }

  return (
    <div style={{ padding: '16px', fontFamily: 'sans-serif' }}>
      <h3>File Browser: {currentPath || 'Root'}</h3>
      <div>
        <h4>Directories</h4>
        <ul>
          {directories.map((dir) => (
            <li key={dir} onClick={() => handleDirectoryClick(dir)} style={{ cursor: 'pointer', color: 'blue' }}>
              📁 {dir}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4>Files</h4>
        <ul>
          {files.map((file) => (
            <li key={file}>📄 {file}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default FileBrowser;