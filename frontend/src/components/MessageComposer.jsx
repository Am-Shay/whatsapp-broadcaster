import React, { useEffect, useRef, useState } from 'react';
import Tooltip from './Tooltip';

function fileIcon(file) {
  if (file.type.startsWith('image/')) return '🖼️';
  if (file.type.startsWith('video/')) return '🎬';
  if (file.type.startsWith('audio/')) return '🎵';
  return '📄';
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtTime(secs) {
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
}

const s = {
  root: { display: 'flex', flexDirection: 'column', gap: '10px' },
  textarea: {
    width: '100%',
    minHeight: '90px',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    resize: 'vertical',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    lineHeight: '1.5',
  },
  row: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px', fontSize: '13px', fontWeight: '500',
    border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff',
    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
  },
  btnRecord: { background: '#fee2e2', borderColor: '#fca5a5', color: '#dc2626' },
  btnStop: { background: '#dc2626', borderColor: '#dc2626', color: '#fff' },
  fileList: { display: 'flex', flexDirection: 'column', gap: '6px' },
  fileItem: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 10px',
    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px',
  },
  fileIcon: { fontSize: '16px', flexShrink: 0 },
  fileMeta: { flex: 1, minWidth: 0 },
  fileName: { fontSize: '13px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileSize: { fontSize: '11px', color: '#9ca3af', flexShrink: 0 },
  removeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#9ca3af', fontSize: '16px', lineHeight: 1, padding: '0 2px', flexShrink: 0,
  },
  audioPreview: { width: '100%', maxWidth: '200px', height: '30px', marginTop: '4px', display: 'block' },
  recDot: { width: '8px', height: '8px', borderRadius: '50%', background: '#fff', animation: 'recpulse 1s infinite', flexShrink: 0 },
};

export default function MessageComposer({ message, onMessageChange, files, onFilesChange }) {
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [audioUrls, setAudioUrls] = useState({});
  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);
  const mountedRef = useRef(true);

  // Maintain object URLs for audio previews
  useEffect(() => {
    setAudioUrls((prev) => {
      const next = {};
      const prevIds = new Set(Object.keys(prev));
      files.forEach(({ id, file }) => {
        if (file.type.startsWith('audio/')) {
          next[id] = prev[id] ?? URL.createObjectURL(file);
          prevIds.delete(id);
        }
      });
      // Revoke stale URLs
      prevIds.forEach((id) => URL.revokeObjectURL(prev[id]));
      return next;
    });
  }, [files]);

  useEffect(() => () => {
    mountedRef.current = false;
    Object.values(audioUrls).forEach(URL.revokeObjectURL);
    clearInterval(timerRef.current);
    if (mediaRecRef.current?.state === 'recording') mediaRecRef.current.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilePick(e) {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;
    const entries = picked.map((file) => ({ id: `f${Date.now()}_${Math.random()}`, file }));
    onFilesChange([...files, ...entries]);
    e.target.value = '';
  }

  function removeFile(id) {
    onFilesChange(files.filter((f) => f.id !== id));
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/ogg;codecs=opus';
      const rec = new MediaRecorder(stream, { mimeType });
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        // Keep actual mimeType so the backend knows the real container format (webm on Chrome, ogg on Firefox)
        const voiceFile = new File([blob], 'voice_message.ogg', { type: mimeType });
        // mountedRef guard: if the component was unmounted (e.g. by Clear), don't write back to parent state
        if (mountedRef.current) {
          onFilesChange((prev) => [...prev, { id: `v${Date.now()}`, file: voiceFile }]);
        }
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start(250);
      mediaRecRef.current = rec;
      setRecording(true);
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds((n) => n + 1), 1000);
    } catch {
      alert('Microphone access denied. Allow microphone permission and try again.');
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    mediaRecRef.current?.stop();
    setRecording(false);
  }

  return (
    <div style={s.root}>
      <style>{`@keyframes recpulse { 0%,100%{opacity:1} 50%{opacity:0.2} }`}</style>

      <textarea
        placeholder="Type a message… (optional when attaching files)"
        value={message}
        onChange={(e) => onMessageChange(e.target.value)}
        style={s.textarea}
        disabled={recording}
      />

      <div style={s.row}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="*/*"
          style={{ display: 'none' }}
          onChange={handleFilePick}
        />
        {!recording && (
          <Tooltip text="Attach images, videos or documents">
            <button type="button" style={s.btn} onClick={() => fileInputRef.current?.click()}>
              📎 Attach files
            </button>
          </Tooltip>
        )}
        {!recording ? (
          <Tooltip text="Record a voice message">
            <button type="button" style={{ ...s.btn, ...s.btnRecord }} onClick={startRecording}>
              🎙 Record voice
            </button>
          </Tooltip>
        ) : (
          <Tooltip text="Stop recording">
            <button type="button" style={{ ...s.btn, ...s.btnStop }} onClick={stopRecording}>
              <span style={s.recDot} />
              Stop · {fmtTime(recSeconds)}
            </button>
          </Tooltip>
        )}
      </div>

      {files.length > 0 && (
        <div style={s.fileList}>
          {files.map(({ id, file }) => (
            <div key={id} style={s.fileItem}>
              <span style={s.fileIcon}>{fileIcon(file)}</span>
              <div style={s.fileMeta}>
                <div style={s.fileName}>{file.name}</div>
                {file.type.startsWith('audio/') && audioUrls[id] && (
                  <audio controls src={audioUrls[id]} style={s.audioPreview} />
                )}
              </div>
              <span style={s.fileSize}>{fmtSize(file.size)}</span>
              <Tooltip text="Remove this attachment" style={{ flexShrink: 0 }}>
                <button
                  type="button"
                  style={s.removeBtn}
                  onClick={() => removeFile(id)}
                  aria-label={`Remove ${file.name}`}
                >
                  ✕
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
