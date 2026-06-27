import React, { useRef, useState } from 'react';

// Inject animation keyframes once — position:fixed keeps tooltips outside any overflow:hidden ancestors
if (typeof document !== 'undefined' && !document.getElementById('tt-styles')) {
  const el = document.createElement('style');
  el.id = 'tt-styles';
  el.textContent = [
    '@keyframes ttFadeIn{',
    'from{opacity:0;transform:translateX(-50%) translateY(calc(-100% + 4px))}',
    'to{opacity:1;transform:translateX(-50%) translateY(-100%)}',
    '}',
    '@keyframes ttFadeInDown{',
    'from{opacity:0;transform:translateX(-50%) translateY(-4px)}',
    'to{opacity:1;transform:translateX(-50%) translateY(0)}',
    '}',
  ].join('');
  document.head.appendChild(el);
}

const DELAY_MS = 1000;

export default function Tooltip({ text, children, placement = 'top', style }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, bottom: 0 });
  const wrapperRef = useRef(null);
  const timerRef = useRef(null);

  function handleMouseEnter() {
    timerRef.current = setTimeout(() => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (rect) setPos({ x: rect.left + rect.width / 2, y: rect.top, bottom: rect.bottom });
      setVisible(true);
    }, DELAY_MS);
  }

  function handleMouseLeave() {
    clearTimeout(timerRef.current);
    setVisible(false);
  }

  const isTop = placement !== 'bottom';

  const boxStyle = {
    position: 'fixed',
    left: `${pos.x}px`,
    zIndex: 9999,
    pointerEvents: 'none',
    background: '#1f2937',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '500',
    lineHeight: '1.4',
    padding: '5px 9px',
    borderRadius: '6px',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    ...(isTop
      ? {
          top: `${pos.y - 8}px`,
          transform: 'translateX(-50%) translateY(-100%)',
          animation: 'ttFadeIn 0.15s ease',
        }
      : {
          top: `${pos.bottom + 8}px`,
          transform: 'translateX(-50%)',
          animation: 'ttFadeInDown 0.15s ease',
        }),
  };

  const arrowStyle = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 0,
    height: 0,
    ...(isTop
      ? {
          bottom: '-5px',
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '5px solid #1f2937',
        }
      : {
          top: '-5px',
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderBottom: '5px solid #1f2937',
        }),
  };

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', display: 'inline-flex', ...style }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {visible && (
        <div style={boxStyle}>
          {text}
          <div style={arrowStyle} />
        </div>
      )}
    </div>
  );
}
