import React, { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 2000;

// ── helpers ───────────────────────────────────────────────────────────────────

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Maps server stage + elapsed time → status message shown under the spinner.
// Time-based thresholds override stage messages when the wait is unusually long.
function getPreQrMessage(stage, elapsedSecs) {
  if (elapsedSecs >= 60) return 'This is taking a while. Try refreshing the page.';
  if (elapsedSecs >= 30) return 'Taking longer than usual… server may be starting up';
  switch (stage) {
    case 'browser_starting':
      return elapsedSecs >= 15 ? 'Waiting for QR code…' : 'Starting browser…';
    case 'qr_ready':
      return 'QR ready — please scan';
    default:
      return 'Initializing WhatsApp client…';
  }
}

function getConnectingMessage(secs) {
  if (secs >= 45) return 'Connection is slow — server location may be causing delay';
  if (secs >= 20) return 'Still connecting… please wait';
  return 'QR scanned! Connecting to WhatsApp…';
}

// ── styles ────────────────────────────────────────────────────────────────────

const s = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100dvh',
    padding: '24px 16px',
    boxSizing: 'border-box',
    fontFamily: 'system-ui, sans-serif',
    background: '#f0f2f5',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '40px 32px',
    maxWidth: '360px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
  },
  logo: { fontSize: '40px', marginBottom: '8px' },
  title: { fontSize: '20px', fontWeight: '700', color: '#111', margin: '0 0 6px' },
  subtitle: { fontSize: '14px', color: '#666', margin: '0 0 28px', lineHeight: '1.5' },

  qrImg: {
    width: '220px',
    height: '220px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    display: 'block',
    margin: '0 auto 20px',
  },

  // Loading placeholder (pre-QR and connecting phases)
  loadingBox: {
    width: '220px',
    minHeight: '220px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    margin: '0 auto 20px',
    background: '#fafafa',
    padding: '24px 20px',
    boxSizing: 'border-box',
  },
  spinner: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '3px solid #e5e7eb',
    borderTop: '3px solid #25D366',
    animation: 'qr-spin 0.85s linear infinite',
    flexShrink: 0,
  },
  statusMsg: {
    fontSize: '13px',
    color: '#374151',
    lineHeight: '1.5',
    textAlign: 'center',
  },
  statusMsgWarn: {
    fontSize: '13px',
    color: '#b45309',
    lineHeight: '1.5',
    textAlign: 'center',
  },
  elapsedTime: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#6b7280',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.05em',
    fontFamily: 'ui-monospace, monospace',
  },

  hint: { fontSize: '12px', color: '#999' },

  // Connected screen
  connectedIcon: { fontSize: '56px', marginBottom: '16px' },
  connectedName: { fontSize: '22px', fontWeight: '700', color: '#111', margin: '0 0 4px' },
  connectedPhone: { fontSize: '15px', color: '#555', margin: '0 0 28px' },
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: '#dcfce7', color: '#16a34a',
    borderRadius: '20px', padding: '6px 14px',
    fontSize: '13px', fontWeight: '600',
  },
  dot: { width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a' },

  error: { fontSize: '13px', color: '#dc2626', marginTop: '12px' },
};

// ── component ─────────────────────────────────────────────────────────────────

export default function QRScreen({ onConnected, version }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [stage, setStage] = useState('initializing');
  const [connInfo, setConnInfo] = useState(null);
  const [error, setError] = useState(null);
  const [connectedShown, setConnectedShown] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [connectingElapsedSecs, setConnectingElapsedSecs] = useState(0);

  const pollRef = useRef(null);
  const tickRef = useRef(null);
  const startTimeRef = useRef(null);      // when init began (from server or local)
  const connectingStartRef = useRef(null); // when 'connecting' stage was first seen

  async function poll() {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      setError(null);

      const newStage = data.stage ?? (data.connected ? 'ready' : 'initializing');
      setStage(newStage);

      // Anchor the elapsed timer on first non-connected response
      if (!data.connected && !startTimeRef.current) {
        startTimeRef.current = data.initStartedAt ?? Date.now();
      }

      // Track when connecting phase began
      if (newStage === 'connecting') {
        if (!connectingStartRef.current) connectingStartRef.current = Date.now();
        setQrDataUrl(null); // QR no longer relevant once scanned
      } else {
        connectingStartRef.current = null;
      }

      if (data.connected) {
        startTimeRef.current = null;
        connectingStartRef.current = null;
        setConnInfo({ phone: data.phone, name: data.name });
        if (!connectedShown) {
          setConnectedShown(true);
          setTimeout(() => onConnected?.({ phone: data.phone, name: data.name }), 1800);
        }
        return;
      }

      // Fetch QR image only when the server says it's ready
      if (newStage === 'qr_ready') {
        const qrRes = await fetch('/api/qr');
        if (!qrRes.ok) throw new Error(`QR ${qrRes.status}`);
        const qrData = await qrRes.json();
        if (qrData.qr) setQrDataUrl(qrData.qr);
      }
    } catch {
      setError('Cannot reach server. Retrying…');
    }
  }

  useEffect(() => {
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    tickRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedSecs(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
      if (connectingStartRef.current) {
        setConnectingElapsedSecs(Math.floor((Date.now() - connectingStartRef.current) / 1000));
      }
    }, 1000);

    return () => {
      clearInterval(pollRef.current);
      clearInterval(tickRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── connected screen ──────────────────────────────────────────────────────────

  if (stage === 'ready') {
    return (
      <div style={s.wrapper}>
        <div style={s.card}>
          <div style={s.connectedIcon}>&#128242;</div>
          <p style={s.connectedName}>{connInfo?.name}</p>
          <p style={s.connectedPhone}>+{connInfo?.phone}</p>
          <span style={s.badge}><span style={s.dot} />Connected</span>
        </div>
      </div>
    );
  }

  // ── connecting screen (QR scanned, waiting for WhatsApp auth) ─────────────────

  if (stage === 'connecting') {
    const msg = getConnectingMessage(connectingElapsedSecs);
    const isWarn = connectingElapsedSecs >= 20;
    return (
      <div style={s.wrapper}>
        <style>{`@keyframes qr-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={s.card}>
          <div style={s.logo}>&#128242;</div>
          <h1 style={s.title}>Connecting…</h1>
          <div style={s.loadingBox}>
            <div style={s.spinner} />
            <span style={isWarn ? s.statusMsgWarn : s.statusMsg}>{msg}</span>
            <span style={s.elapsedTime}>{formatTime(connectingElapsedSecs)}</span>
          </div>
          {error && <p style={s.error}>{error}</p>}
          {version && <p style={{ fontSize: '11px', color: '#ccc', margin: '16px 0 0' }}>v{version}</p>}
        </div>
      </div>
    );
  }

  // ── pre-QR screen (spinner) or QR screen ─────────────────────────────────────

  const preQrMsg = getPreQrMessage(stage, elapsedSecs);
  const isWarnMsg = elapsedSecs >= 30;

  return (
    <div style={s.wrapper}>
      <style>{`@keyframes qr-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={s.card}>
        <div style={s.logo}>&#128242;</div>
        <h1 style={s.title}>Connect WhatsApp</h1>
        <p style={s.subtitle}>
          Open WhatsApp on your phone, tap <strong>Linked Devices</strong>, then scan the code below.
        </p>

        {qrDataUrl ? (
          <img src={qrDataUrl} alt="WhatsApp QR code" style={s.qrImg} />
        ) : (
          <div style={s.loadingBox}>
            <div style={s.spinner} />
            <span style={isWarnMsg ? s.statusMsgWarn : s.statusMsg}>{preQrMsg}</span>
            <span style={s.elapsedTime}>{formatTime(elapsedSecs)}</span>
          </div>
        )}

        <p style={s.hint}>QR refreshes automatically</p>
        {error && <p style={s.error}>{error}</p>}
        {version && <p style={{ fontSize: '11px', color: '#ccc', margin: '16px 0 0' }}>v{version}</p>}
      </div>
    </div>
  );
}
