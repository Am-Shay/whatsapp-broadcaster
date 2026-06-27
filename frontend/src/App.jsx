import React, { useEffect, useState } from 'react';
import QRScreen from './components/QRScreen';
import GroupSelector from './components/GroupSelector';
import MessageComposer from './components/MessageComposer';
import DelayPicker from './components/DelayPicker';
import Tooltip from './components/Tooltip';

// ── helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function randomMs(minSec, maxSec) {
  return (Math.random() * (maxSec - minSec) + minSec) * 1000;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── styles ────────────────────────────────────────────────────────────────────

const s = {
  page: { minHeight: '100dvh', background: '#f0f2f5', fontFamily: 'system-ui, sans-serif' },

  header: {
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: '17px', fontWeight: '700', color: '#111', margin: 0,
    display: 'flex', alignItems: 'center', gap: '8px', flex: 1,
  },
  statusDot: (connected) => ({
    width: '9px', height: '9px', borderRadius: '50%', flexShrink: 0,
    background: connected ? '#16a34a' : '#dc2626',
    boxShadow: connected ? '0 0 0 3px #dcfce7' : '0 0 0 3px #fee2e2',
  }),
  userBadge: {
    fontSize: '13px', color: '#555', display: 'flex', alignItems: 'center', gap: '6px',
  },
  disconnectBtn: {
    padding: '5px 12px', fontSize: '12px', fontWeight: '500',
    border: '1px solid #fca5a5', borderRadius: '6px',
    background: '#fff', color: '#dc2626', cursor: 'pointer',
  },
  headerVersion: { fontSize: '11px', color: '#9ca3af', fontWeight: '400', letterSpacing: '0.02em' },

  main: {
    maxWidth: '640px', margin: '0 auto', padding: '20px 16px',
    display: 'flex', flexDirection: 'column', gap: '16px',
  },
  banner: {
    background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px',
    padding: '12px 16px', fontSize: '13px', color: '#dc2626', fontWeight: '500',
  },
  card: {
    background: '#fff', borderRadius: '12px', padding: '20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  cardTitle: {
    fontSize: '12px', fontWeight: '700', color: '#6b7280', margin: '0 0 14px',
    textTransform: 'uppercase', letterSpacing: '0.08em',
  },

  buttonRow: { display: 'flex', gap: '10px' },
  sendBtn: {
    flex: 1, padding: '14px', fontSize: '16px', fontWeight: '700',
    border: 'none', borderRadius: '12px', background: '#25D366', color: '#fff',
    cursor: 'pointer', transition: 'opacity 0.15s',
  },
  sendBtnDisabled: { opacity: 0.45, cursor: 'not-allowed' },
  clearBtn: {
    padding: '14px 18px', fontSize: '15px', fontWeight: '600',
    border: '1px solid #d1d5db', borderRadius: '12px',
    background: '#fff', color: '#6b7280', cursor: 'pointer',
    flexShrink: 0, transition: 'opacity 0.15s, color 0.15s',
  },
  clearBtnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  validationMsg: { fontSize: '13px', color: '#dc2626', paddingTop: '6px' },

  // ── status panel ─────────────────────────────────────────────────────────────
  statusPanel: {
    background: '#fff', borderRadius: '12px', padding: '16px 20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    display: 'flex', flexDirection: 'column', gap: '2px',
  },
  statusHeader: {
    fontSize: '13px', fontWeight: '600', color: '#374151',
    margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  statusRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '7px 0', borderBottom: '1px solid #f3f4f6', fontSize: '14px',
  },
  statusIcon: (status) => {
    const map = { waiting: '#9ca3af', sending: '#f59e0b', sent: '#16a34a', failed: '#dc2626' };
    return { flexShrink: 0, fontSize: '15px', color: map[status] ?? '#9ca3af', width: '18px', textAlign: 'center' };
  },
  statusName: { flex: 1, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  statusError: { fontSize: '12px', color: '#dc2626', flexShrink: 0, maxWidth: '45%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  statusSummary: {
    fontSize: '14px', fontWeight: '600', color: '#16a34a',
    padding: '10px 0 0', textAlign: 'center',
  },
  statusSummaryFail: { color: '#f59e0b' },
  countdownRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '9px 0', borderBottom: '1px solid #f3f4f6',
  },
  countdownIcon: { fontSize: '15px', width: '18px', textAlign: 'center', flexShrink: 0 },
  countdownText: { fontSize: '15px', color: '#d97706', fontWeight: '500' },
  countdownSecs: { fontSize: '17px', fontWeight: '700', color: '#b45309' },
};

const STATUS_ICON = { waiting: '·', sending: '›', sent: '✓', failed: '✗' };

// ── component ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState('qr');
  const [connInfo, setConnInfo] = useState({ phone: null, name: null });
  const [isConnected, setIsConnected] = useState(false);
  const [serverDown, setServerDown] = useState(false);
  const [version, setVersion] = useState('');

  useEffect(() => {
    fetch('/api/version')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.version) setVersion(d.version); })
      .catch(() => {});
  }, []);

  // groups cached from GroupSelector (needed for name lookup in send log)
  const [groups, setGroups] = useState([]);

  // form state
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]); // [{ id, file }]
  const [minDelay, setMinDelay] = useState(10);
  const [maxDelay, setMaxDelay] = useState(30);

  // send state
  const [isSending, setIsSending] = useState(false);
  const [sendLog, setSendLog] = useState(null); // null | [{groupId,name,status,error}]
  const [countdown, setCountdown] = useState(null); // null | number — seconds remaining before next send
  const [resetKey, setResetKey] = useState(0); // incremented to force-remount MessageComposer on clear

  // ── status polling ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (screen !== 'main') return;

    async function checkStatus() {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) throw new Error();
        const data = await res.json();
        setServerDown(false);
        setIsConnected(data.connected);
        if (!data.connected) {
          setScreen('qr');
        }
      } catch {
        setServerDown(true);
      }
    }

    checkStatus();
    const id = setInterval(checkStatus, 3000);
    return () => clearInterval(id);
  }, [screen]);

  // ── handlers ──────────────────────────────────────────────────────────────────

  function handleConnected(info) {
    setConnInfo(info ?? {});
    setIsConnected(true);
    setScreen('main');
  }

  async function handleDisconnect() {
    try { await fetch('/api/disconnect', { method: 'POST' }); } catch { /* ignore */ }
    setIsConnected(false);
    setScreen('qr');
  }

  const hasContent = message.trim() || files.length > 0;
  const canSend = selectedGroups.size > 0 && hasContent && !isSending;

  function handleClear() {
    if (!window.confirm('Are you sure you want to clear everything?')) return;
    setSelectedGroups(new Set());
    setMessage('');
    setFiles([]);
    setMinDelay(10);
    setMaxDelay(30);
    setSendLog(null);
    setCountdown(null);
    setResetKey((k) => k + 1);
  }

  async function handleSend() {
    if (!canSend) return;

    // Build initial log with names from cached groups
    const groupMap = Object.fromEntries(groups.map((g) => [g.id, g.name]));
    const groupIds = [...selectedGroups];
    const initialLog = groupIds.map((id) => ({
      groupId: id,
      name: groupMap[id] ?? id,
      status: 'waiting',
      error: null,
    }));
    setSendLog(initialLog);
    setIsSending(true);

    // Encode all files once (before the group loop)
    let mediaItems = [];
    try {
      mediaItems = await Promise.all(
        files.map(async ({ file }) => ({
          data: await readFileAsBase64(file),
          mimetype: file.type || 'application/octet-stream',
          filename: file.name,
        }))
      );
    } catch (err) {
      console.error('[send] file encoding failed:', err.message);
      // Continue without media — don't abort the whole send
    }

    for (let i = 0; i < groupIds.length; i++) {
      const groupId = groupIds[i];

      if (i > 0) {
        const delayMs = randomMs(minDelay, maxDelay);
        const delaySecs = Math.round(delayMs / 1000);
        if (delaySecs > 0) {
          for (let remaining = delaySecs; remaining > 0; remaining--) {
            setCountdown(remaining);
            await sleep(1000);
          }
          setCountdown(null);
        } else {
          await sleep(delayMs);
        }
      }

      setSendLog((log) =>
        log.map((item) => item.groupId === groupId ? { ...item, status: 'sending' } : item)
      );

      try {
        const body = {
          groupIds: [groupId],
          message: message.trim() || undefined,
          minDelay: 0,
          maxDelay: 0,
          ...(mediaItems.length > 0 ? { mediaItems } : {}),
        };

        const res = await fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (res.ok || res.status === 202) {
          setSendLog((log) =>
            log.map((item) => item.groupId === groupId ? { ...item, status: 'sent' } : item)
          );
        } else {
          let reason = `HTTP ${res.status}`;
          try { const j = await res.json(); reason = j.error ?? reason; } catch { /* ignore */ }
          setSendLog((log) =>
            log.map((item) => item.groupId === groupId ? { ...item, status: 'failed', error: reason } : item)
          );
        }
      } catch (err) {
        const reason = err?.message?.includes('fetch') ? 'Server unreachable' : (err?.message ?? 'Unknown error');
        setSendLog((log) =>
          log.map((item) => item.groupId === groupId ? { ...item, status: 'failed', error: reason } : item)
        );
      }
    }

    setCountdown(null);
    setIsSending(false);
  }

  // ── QR screen ─────────────────────────────────────────────────────────────────

  if (screen === 'qr') {
    return <QRScreen onConnected={handleConnected} version={version} />;
  }

  // ── main screen ───────────────────────────────────────────────────────────────

  const sentCount = sendLog?.filter((i) => i.status === 'sent').length ?? 0;
  const doneCount = sendLog?.filter((i) => i.status !== 'waiting' && i.status !== 'sending').length ?? 0;
  const allDone = sendLog && !isSending && doneCount === sendLog.length;

  return (
    <div style={s.page}>
      <AppHeader
        connInfo={connInfo}
        isConnected={isConnected}
        onDisconnect={handleDisconnect}
        version={version}
      />

      <div style={s.main}>
        {serverDown && (
          <div style={s.banner}>
            ⚠️ Server unreachable — restart <code>npm start</code> then reload the page.
          </div>
        )}

        <div style={s.card}>
          <p style={s.cardTitle}>Groups</p>
          <GroupSelector
            selectedGroups={selectedGroups}
            onChange={setSelectedGroups}
            onGroupsLoaded={setGroups}
          />
        </div>

        <div style={s.card}>
          <p style={s.cardTitle}>Message</p>
          <MessageComposer
            key={resetKey}
            message={message}
            onMessageChange={setMessage}
            files={files}
            onFilesChange={setFiles}
          />
        </div>

        <div style={s.card}>
          <p style={s.cardTitle}>Delay</p>
          <DelayPicker
            minDelay={minDelay}
            maxDelay={maxDelay}
            onChange={(min, max) => { setMinDelay(min); setMaxDelay(max); }}
          />
        </div>

        <div style={s.buttonRow}>
          <Tooltip text="Clear all fields and start over">
            <button
              type="button"
              style={{ ...s.clearBtn, ...(isSending ? s.clearBtnDisabled : {}) }}
              onClick={handleClear}
              disabled={isSending}
            >
              Clear
            </button>
          </Tooltip>
          <Tooltip text="Send message to all selected groups" style={{ flex: 1 }}>
            <button
              type="button"
              style={{ ...s.sendBtn, width: '100%', ...(canSend ? {} : s.sendBtnDisabled) }}
              onClick={handleSend}
              disabled={!canSend}
            >
              {isSending
                ? `Sending… (${sentCount}/${selectedGroups.size})`
                : selectedGroups.size > 0
                ? `Send to ${selectedGroups.size} group${selectedGroups.size !== 1 ? 's' : ''}`
                : 'Select groups to send'}
            </button>
          </Tooltip>
        </div>

        {selectedGroups.size > 0 && !hasContent && !isSending && (
          <p style={s.validationMsg}>Add a message or attach a file to continue.</p>
        )}

        {sendLog && (
          <div style={s.statusPanel}>
            <p style={s.statusHeader}>Sending status</p>
            {sendLog.map((item) => (
              <div key={item.groupId} style={s.statusRow}>
                <span style={s.statusIcon(item.status)}>{STATUS_ICON[item.status]}</span>
                <span style={s.statusName}>{item.name}</span>
                {item.status === 'failed' && item.error && (
                  <span style={s.statusError}>{item.error}</span>
                )}
              </div>
            ))}
            {countdown !== null && (
              <div style={s.countdownRow}>
                <span style={s.countdownIcon}>⏱</span>
                <span style={s.countdownText}>
                  Next send in: <span style={s.countdownSecs}>{countdown}s</span>…
                </span>
              </div>
            )}
            {allDone && (
              <div style={{ ...s.statusSummary, ...(sentCount < sendLog.length ? s.statusSummaryFail : {}) }}>
                {sentCount === sendLog.length
                  ? `✓ Done — all ${sentCount} sent`
                  : `⚠ Done — sent ${sentCount} of ${sendLog.length}`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function AppHeader({ connInfo, isConnected, onDisconnect, version }) {
  return (
    <header style={s.header}>
      <h1 style={s.headerTitle}>
        <span style={s.statusDot(isConnected)} title={isConnected ? 'Connected' : 'Disconnected'} />
        📣 WhatsApp Broadcaster
        {version && <span style={s.headerVersion}>v{version}</span>}
      </h1>
      {connInfo?.name && (
        <div style={s.userBadge}>
          {connInfo.name}
          {connInfo.phone ? ` · +${connInfo.phone}` : ''}
        </div>
      )}
      {isConnected && (
        <Tooltip text="Disconnect from WhatsApp" placement="bottom">
          <button style={s.disconnectBtn} onClick={onDisconnect} type="button">
            Disconnect
          </button>
        </Tooltip>
      )}
    </header>
  );
}
