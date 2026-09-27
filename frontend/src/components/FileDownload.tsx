import { useState } from 'react';
import { downloadFile } from '../api/documents';
import type { DocumentFile } from '../api/types';
import { formatBytes } from '../format';

/**
 * The file endpoint needs the auth header, so a plain <a href> won't work:
 * fetch the blob and hand it to the browser via an object URL.
 */
export function FileDownload({ file }: { file: DocumentFile }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const blob = await downloadFile(file.url);
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement('a'), { href: url, download: file.name });
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="file">
      <button type="button" className="link" onClick={download} disabled={busy}>
        📎 {file.name}
      </button>
      <span className="muted"> · {formatBytes(file.size)}</span>
      {error && <span className="field-error"> {error}</span>}
    </span>
  );
}
