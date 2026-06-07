import React, { useState, Component, ErrorInfo, ReactNode } from 'react';
import { 
  usePluginData, 
  useHostNavigation,
  MarkdownBlock
} from "@paperclipai/plugin-sdk/ui";
import type { 
  PluginWidgetProps, 
  PluginDetailTabProps, 
  PluginProjectSidebarItemProps 
} from "@paperclipai/plugin-sdk/ui";

interface FileListResponse {
  files: string[];
  directories: string[];
  currentPath: string;
  rootDir: string;
}

interface FileContentResponse {
  content: string;
  isBinary: boolean;
  ext: string;
}

interface FileBrowserMainProps {
  companyId?: string | null;
  projectId?: string | null;
  entityId?: string | null;
  entityType?: string | null;
}

class LocalErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Plugin UI Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '16px', color: 'var(--destructive, #ef4444)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '8px', margin: '16px', backgroundColor: 'var(--card, #ffffff)' }}>
          <h4 style={{ margin: '0 0 8px 0' }}>Plugin UI Crash</h4>
          <p style={{ fontSize: '13px', margin: 0 }}>{this.state.error?.message || "Unknown error"}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Icons
const HomeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const FolderIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary, #6366f1)', opacity: 0.95 }}>
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
  </svg>
);

const FileIcon = ({ ext }: { ext: string }) => {
  let strokeColor = 'currentColor';
  if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) strokeColor = '#f59e0b';
  else if (ext === 'json') strokeColor = '#3b82f6';
  else if (ext === 'md') strokeColor = '#10b981';
  else if (['zip', 'tar', 'gz'].includes(ext)) strokeColor = '#ec4899';
  
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85 }}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
};

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
);

const ZipIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" x2="12" y1="22.08" y2="12" />
  </svg>
);

const PreviewIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

// Local Spinner to replace flaky SDK version
const LocalSpinner = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const pixelSize = size === 'sm' ? '12px' : size === 'lg' ? '32px' : '24px';
  const borderWidth = size === 'sm' ? '1.5px' : '2px';
  return (
    <div style={{
      width: pixelSize,
      height: pixelSize,
      border: `${borderWidth} solid var(--border, #e2e8f0)`,
      borderTopColor: 'var(--primary, #6366f1)',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite'
    }} />
  );
};

// Local JSON View to replace flaky SDK version
const LocalJsonView = ({ content }: { content: string }) => {
  try {
    const json = JSON.parse(content);
    return (
      <pre style={{ 
        margin: 0, 
        whiteSpace: 'pre-wrap', 
        fontSize: '13px', 
        fontFamily: 'monospace', 
        padding: '16px',
        backgroundColor: 'var(--secondary, #f8fafc)',
        borderRadius: '8px',
        border: '1px solid var(--border, #e2e8f0)',
        color: 'var(--foreground, #1e293b)',
        lineHeight: 1.5
      }}>
        {JSON.stringify(json, null, 2)}
      </pre>
    );
  } catch (e) {
    return (
      <pre style={{ 
        margin: 0, 
        whiteSpace: 'pre-wrap', 
        fontSize: '13px', 
        fontFamily: 'monospace', 
        padding: '16px',
        backgroundColor: 'var(--secondary, #f8fafc)',
        borderRadius: '8px',
        border: '1px solid var(--border, #e2e8f0)',
        color: 'var(--foreground, #1e293b)'
      }}>
        {content}
      </pre>
    );
  }
};

// Preview Component
function FilePreview({ path, context, onClose }: { path: string, context: any, onClose: () => void }) {
  const { data, loading, error } = usePluginData<FileContentResponse>("get-file-content", {
    path,
    ...context
  });

  const renderContent = () => {
    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><LocalSpinner size="lg" /></div>;
    if (error) return <div style={{ color: 'var(--destructive)', padding: '20px' }}>Error loading preview: {error.message}</div>;
    if (!data) return null;

    const { content, isBinary, ext } = data;

    if (isBinary) {
      if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'].includes(ext)) {
        const mime = ext === '.svg' ? 'image/svg+xml' : `image/${ext.replace('.', '')}`;
        return (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px', backgroundColor: 'var(--secondary, #f8fafc)', borderRadius: '8px' }}>
            <img src={`data:${mime};base64,${content}`} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} alt={path} />
          </div>
        );
      }
      return <div style={{ padding: '20px', textAlign: 'center' }}>Binary file preview not supported for this type ({ext})</div>;
    }

    if (ext === '.md') {
      return (
        <div style={{ padding: '20px', backgroundColor: 'var(--card, #ffffff)', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)' }}>
          <MarkdownBlock content={content} />
        </div>
      );
    }

    if (ext === '.json') {
      return <LocalJsonView content={content} />;
    }

    return (
      <div style={{ padding: '16px', backgroundColor: 'var(--secondary, #f8fafc)', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', overflow: 'auto' }}>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '13px', fontFamily: 'monospace', lineHeight: 1.5, color: 'var(--foreground, #1e293b)' }}>{content}</pre>
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '40px'
    }} onClick={onClose}>
      <div 
        style={{
          width: '100%',
          maxWidth: '1000px',
          maxHeight: '90vh',
          backgroundColor: 'var(--background, #ffffff)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--card, #ffffff)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileIcon ext={path.split('.').pop() || ''} />
            <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--foreground, #1e293b)' }}>{path.split('/').pop()}</span>
          </div>
          <button 
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              color: 'var(--muted-foreground, #64748b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s'
            }}
            className="hover-bg-secondary"
          >
            <CloseIcon />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export function FileBrowserMain({ companyId, projectId, entityId, entityType }: FileBrowserMainProps) {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [zipping, setZipping] = useState<boolean>(false);
  const [previewPath, setPreviewPath] = useState<string | null>(null);

  const context = { companyId, projectId, entityId, entityType };
  const params: any = { path: currentPath, ...context };

  const { data, loading, error } = usePluginData<FileListResponse>("list-files", params);

  const handleDirectoryClick = (dir: string) => {
    setCurrentPath(currentPath ? `${currentPath}/${dir}` : dir);
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setCurrentPath('');
      return;
    }
    const parts = currentPath.split('/');
    const newPath = parts.slice(0, index + 1).join('/');
    setCurrentPath(newPath);
  };

  const buildApiUrl = (route: string, specificPath: string) => {
    let url = `/api/plugins/paperclip-plugin-file-browser/api/files/${route}?path=${encodeURIComponent(specificPath)}`;
    if (companyId) url += `&companyId=${encodeURIComponent(companyId)}`;
    if (projectId) url += `&projectId=${encodeURIComponent(projectId)}`;
    if (entityId) url += `&entityId=${encodeURIComponent(entityId)}`;
    if (entityType) url += `&entityType=${encodeURIComponent(entityType)}`;
    return url;
  };

  const triggerBlobDownload = (base64Data: string, fileName: string, mimeType: string) => {
    let cleaned = base64Data;
    try {
      const parsed = JSON.parse(base64Data);
      if (parsed && typeof parsed === 'object' && parsed.body) {
        cleaned = parsed.body;
      } else if (typeof parsed === 'string') {
        cleaned = parsed;
      }
    } catch (e) {}
    const byteCharacters = atob(cleaned);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadClick = async (filePath: string, fileName: string) => {
    if (downloadingFile) return;
    setDownloadingFile(fileName);
    try {
      const response = await fetch(buildApiUrl('download', filePath));
      if (!response.ok) throw new Error("Failed to download file");
      const base64Data = await response.text();
      triggerBlobDownload(base64Data, fileName, 'application/octet-stream');
    } catch (err: any) {
      alert("Download failed: " + (err.message || String(err)));
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleZipClick = async () => {
    if (zipping) return;
    setZipping(true);
    try {
      const folderName = currentPath.split('/').pop() || 'root';
      const response = await fetch(buildApiUrl('zip', currentPath));
      if (!response.ok) throw new Error("Failed to generate ZIP");
      const base64Data = await response.text();
      triggerBlobDownload(base64Data, `${folderName}.zip`, 'application/zip');
    } catch (err: any) {
      alert("ZIP creation failed: " + (err.message || String(err)));
    } finally {
      setZipping(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '200px', width: '100%', gap: '12px' }}>
        <LocalSpinner size="lg" />
        <span style={{ fontSize: '12px', color: 'var(--muted-foreground, #94a3b8)' }}>Loading files...</span>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        ` }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '12px 16px',
        backgroundColor: 'var(--destructive-muted, rgba(239, 68, 68, 0.1))',
        border: '1px solid var(--destructive, rgba(239, 68, 68, 0.2))',
        borderRadius: '8px',
        color: 'var(--destructive, #ef4444)',
        margin: '16px'
      }}>
        <h4 style={{ margin: '0 0 6px 0', fontWeight: 600, fontSize: '14px' }}>Error loading files</h4>
        <p style={{ margin: 0, fontSize: '13px' }}>{error.message || String(error)}</p>
      </div>
    );
  }

  const breadcrumbs = currentPath ? currentPath.split('/') : [];
  const filesList = data?.files || [];
  const dirsList = data?.directories || [];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      padding: '16px',
      color: 'var(--foreground, #1e293b)',
      fontFamily: 'inherit',
      height: '100%',
      overflow: 'hidden'
    }}>
      {previewPath && (
        <FilePreview 
          path={previewPath} 
          context={context} 
          onClose={() => setPreviewPath(null)} 
        />
      )}

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '14px',
          fontWeight: 500,
          color: 'var(--muted-foreground, #64748b)',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          paddingBottom: '4px'
        }}>
          <span 
            onClick={() => handleBreadcrumbClick(-1)}
            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            className="hover-primary"
          >
            <HomeIcon /> root
          </span>
          {breadcrumbs.map((part, index) => (
            <React.Fragment key={index}>
              <span style={{ opacity: 0.5 }}>/</span>
              <span 
                onClick={() => handleBreadcrumbClick(index)}
                style={{ cursor: 'pointer' }}
                className="hover-primary"
              >
                {part}
              </span>
            </React.Fragment>
          ))}
        </div>

        <button 
          onClick={handleZipClick}
          disabled={zipping}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            backgroundColor: 'var(--primary, #6366f1)',
            color: 'var(--primary-foreground, #ffffff)',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            transition: 'all 0.15s ease',
            cursor: zipping ? 'not-allowed' : 'pointer',
            opacity: zipping ? 0.7 : 1
          }}
          className="btn-zip"
        >
          <ZipIcon /> {zipping ? 'Zipping...' : 'Download ZIP'}
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '10px',
        overflowY: 'auto',
        maxHeight: '60vh',
        paddingRight: '4px'
      }}>
        {dirsList.map((dir) => (
          <div 
            key={dir} 
            onClick={() => handleDirectoryClick(dir)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              backgroundColor: 'var(--secondary, #f8fafc)',
              border: '1px solid var(--border, #e2e8f0)',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            className="dir-card"
          >
            <FolderIcon />
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <span style={{ fontWeight: 500, fontSize: '13px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {dir}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--muted-foreground, #94a3b8)' }}>Folder</span>
            </div>
          </div>
        ))}

        {filesList.map((file) => {
          const ext = file.split('.').pop()?.toLowerCase() || '';
          const fullFilePath = currentPath ? `${currentPath}/${file}` : file;
          const isDownloadingThis = downloadingFile === file;
          
          const isPreviewable = [
            'md', 'json', 'txt', 'js', 'ts', 'jsx', 'tsx', 'css', 'html',
            'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'pdf', 'yml', 'yaml', 'toml', 'env'
          ].includes(ext);

          return (
            <div 
              key={file}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                backgroundColor: 'var(--card, #ffffff)',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: '6px',
                transition: 'all 0.15s ease'
              }}
              className="file-card"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1 }}>
                <FileIcon ext={ext} />
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span style={{ fontWeight: 450, fontSize: '13px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {file}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--muted-foreground, #94a3b8)' }}>
                    {ext.toUpperCase() || 'File'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {isPreviewable && (
                  <button
                    onClick={() => setPreviewPath(fullFilePath)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: 'var(--muted-foreground, #64748b)',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    className="btn-preview"
                    title="Preview file"
                  >
                    <PreviewIcon />
                  </button>
                )}
                <button
                  onClick={() => handleDownloadClick(fullFilePath, file)}
                  disabled={!!downloadingFile}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--secondary, #f8fafc)',
                    border: '1px solid var(--border, #e2e8f0)',
                    color: 'var(--foreground, #1e293b)',
                    cursor: downloadingFile ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    opacity: isDownloadingThis ? 0.7 : 1
                  }}
                  className="btn-download"
                  title="Download file"
                >
                  {isDownloadingThis ? (
                    <LocalSpinner size="sm" />
                  ) : (
                    <DownloadIcon />
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {dirsList.length === 0 && filesList.length === 0 && (
          <div style={{
            gridColumn: '1 / -1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            color: 'var(--muted-foreground, #94a3b8)',
            textAlign: 'center'
          }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 500 }}>This folder is empty</p>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .hover-primary:hover { color: var(--primary, #6366f1) !important; }
        .btn-zip:hover { background-color: var(--primary-hover, #4f46e5) !important; }
        .dir-card:hover { border-color: var(--primary, #6366f1) !important; background-color: var(--accent, #f1f5f9) !important; }
        .file-card:hover { border-color: var(--primary, #6366f1) !important; }
        .btn-preview:hover { color: var(--primary, #6366f1) !important; background-color: var(--secondary, #f8fafc) !important; }
        .btn-download:hover { background-color: var(--primary, #6366f1) !important; color: var(--primary-foreground, #ffffff) !important; border-color: var(--primary, #6366f1) !important; }
        .hover-bg-secondary:hover { background-color: var(--secondary, #f8fafc) !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      ` }} />
    </div>
  );
}

export function DashboardWidget({ context }: PluginWidgetProps) {
  return (
    <LocalErrorBoundary>
      <div style={{ 
        padding: '12px 16px', 
        borderBottom: '1px solid var(--border, #e2e8f0)',
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        color: 'var(--foreground, #1e293b)'
      }}>
        <FolderIcon size={16} />
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>File Browser</h3>
      </div>
      <FileBrowserMain 
        companyId={context?.companyId} 
        projectId={context?.projectId}
        entityId={context?.entityId}
        entityType={context?.entityType}
      />
    </LocalErrorBoundary>
  );
}

export function FileBrowserTab({ context }: PluginDetailTabProps) {
  return (
    <LocalErrorBoundary>
      <FileBrowserMain 
        companyId={context?.companyId} 
        projectId={context?.projectId}
        entityId={context?.entityId}
        entityType={context?.entityType}
      />
    </LocalErrorBoundary>
  );
}

export function FileBrowserSidebarItem({ context }: PluginProjectSidebarItemProps) {
  const hostNavigation = useHostNavigation();
  const projectRef = context?.entityId;
  if (!projectRef) return null;
  return (
    <div style={{ padding: '2px 4px' }}>
      <a 
        {...hostNavigation.linkProps(`/projects/${projectRef}?tab=plugin:paperclip-plugin-file-browser:file-browser-tab`)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 10px',
          color: 'var(--muted-foreground, #64748b)',
          textDecoration: 'none',
          fontSize: '13px',
          fontWeight: 500,
          borderRadius: '6px',
          transition: 'all 0.15s ease'
        }}
        className="sidebar-link-btn"
      >
        <FolderIcon size={14} />
        <span>Files</span>
      </a>
      <style dangerouslySetInnerHTML={{ __html: `
        .sidebar-link-btn:hover {
          color: var(--foreground, #1e293b) !important;
          background-color: var(--secondary, #f8fafc) !important;
        }
      ` }} />
    </div>
  );
}
