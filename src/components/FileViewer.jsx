// src/components/FileViewer.jsx
// One viewer for every file kind:
//  - brief_text rows render the pasted WhatsApp text directly
//  - R2 objects embed inline when previewable (PDF/JPG/PNG/TXT)
//  - AI/CDR, PPT/DOC and other working files show a clear download path instead
import { useEffect, useState } from 'react';
import { getViewLinks, isPreviewable } from '../lib/api.js';

export default function FileViewer({ file, onClose }) {
  const [links, setLinks] = useState(null);
  const [err, setErr] = useState('');

  const isText = file.kind === 'brief_text' || (file.file_name || '').toLowerCase().endsWith('.txt');

  useEffect(() => {
    if (file.storage_key) {
      getViewLinks(file.storage_key).then(setLinks).catch((e) => setErr(e.message));
    }
  }, [file.storage_key]);

  const previewable = file.storage_key && isPreviewable(file.file_name, file.mime_type);

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card viewer">
        <div className="bar">
          <span className="fname">{file.title}</span>
          {links?.downloadUrl && (
            <a className="btn sm" href={links.downloadUrl} target="_blank" rel="noreferrer">Download</a>
          )}
          {file.external_url && (
            <a className="btn sm" href={file.external_url} target="_blank" rel="noreferrer">Open link</a>
          )}
          <button className="btn ghost sm" onClick={onClose}>Close</button>
        </div>

        {file.text_content && <div className="txt">{file.text_content}</div>}

        {file.external_url && !file.text_content && (
          <div className="empty" style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
            <div>
              <p style={{ marginBottom: 10 }}>External transfer link saved here so it never gets lost.</p>
              <a className="btn primary" href={file.external_url} target="_blank" rel="noreferrer">
                Open {new URL(file.external_url).hostname}
              </a>
            </div>
          </div>
        )}

        {file.storage_key && previewable && !isText && (
          links?.embedUrl
            ? <iframe title={file.title} src={links.embedUrl} allowFullScreen />
            : <div className="empty" style={{ flex: 1 }}>{err || 'Preparing preview…'}</div>
        )}

        {file.storage_key && !previewable && (
          <div className="empty" style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
            <div>
              <p style={{ marginBottom: 10 }}>
                {file.file_name?.split('.').pop()?.toUpperCase()} working files can't preview
                in the browser. Download to open in your design tools.
              </p>
              {links?.downloadUrl
                ? <a className="btn primary" href={links.downloadUrl} target="_blank" rel="noreferrer">Download {file.file_name}</a>
                : <span className="eyebrow">{err || 'Getting download link…'}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
