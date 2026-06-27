import React, { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 2000;

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
  logo: {
    fontSize: '40px',
    marginBottom: '8px',
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#111',
    margin: '0 0 6px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    margin: '0 0 28px',
    lineHeight: '1.5',
  },
  qrImg: {
    width: '220px',
    height: '220px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    display: 'block',
    margin: '0 auto 20px',
  },
  qrPlaceholder: {
    width: '220px',
    height: '220px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
    color: '#aaa',
    fontSize: '13px',
    background: '#fafafa',
  },
  hint: {
    fontSize: '12px',
    color: '#999',
  },
  connectedIcon: {
    fontSize: '56px',
    marginBottom: '16px',
  },
  connectedName: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#111',
    margin: '0 0 4px',
  },
  connectedPhone: {
    fontSize: '15px',
    color: '#555',
    margin: '0 0 28px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: '#dcfce7',
    color: '#16a34a',
    borderRadius: '20px',
    padding: '6px 14px',
    fontSize: '13px',
    fontWeight: '600',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#16a34a',
  },
  error: {
    fontSize: '13px',
    color: '#dc2626',
    marginTop: '12px',
  },
};

export default function QRScreen({ onConnected, version }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [status, setStatus] = useState({ connected: false, phone: null, name: null });
  const [error, setError] = useState(null);
  const [connectedShown, setConnectedShown] = useState(false);
  const timerRef = useRef(null);

  async function poll() {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      setStatus(data);
      setError(null);

      if (data.connected) {
        setQrDataUrl(null);
        if (!connectedShown) {
          setConnectedShown(true);
          // Give user a moment to see the connected state before proceeding
          setTimeout(() => onConnected?.({ phone: data.phone, name: data.name }), 1800);
        }
        return;
      }

      // Not connected — fetch QR
      const qrRes = await fetch('/api/qr');
      if (!qrRes.ok) throw new Error(`QR ${qrRes.status}`);
      const qrData = await qrRes.json();
      if (qrData.qr) setQrDataUrl(qrData.qr);
    } catch (err) {
      setError('Cannot reach server. Retrying…');
    }
  }

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status.connected) {
    return (
      <div style={s.wrapper}>
        <div style={s.card}>
          <div style={s.connectedIcon}>&#128242;</div>
          <p style={s.connectedName}>{status.name}</p>
          <p style={s.connectedPhone}>+{status.phone}</p>
          <span style={s.badge}>
            <span style={s.dot} />
            Connected
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <div style={s.logo}>&#128242;</div>
        <h1 style={s.title}>Connect WhatsApp</h1>
        <p style={s.subtitle}>
          Open WhatsApp on your phone, tap{' '}
          <strong>Linked Devices</strong>, then scan the code below.
        </p>

        {qrDataUrl ? (
          <img src={qrDataUrl} alt="WhatsApp QR code" style={s.qrImg} />
        ) : (
          <div style={s.qrPlaceholder}>Waiting for QR…</div>
        )}

        <p style={s.hint}>QR refreshes automatically</p>
        {error && <p style={s.error}>{error}</p>}
        {version && <p style={{ fontSize: '11px', color: '#ccc', margin: '16px 0 0' }}>v{version}</p>}
      </div>
    </div>
  );
}
