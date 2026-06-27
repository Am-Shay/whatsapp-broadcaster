import React from 'react';

const s = {
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  label: {
    fontSize: '14px',
    color: '#444',
    whiteSpace: 'nowrap',
  },
  input: {
    width: '70px',
    padding: '7px 10px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    textAlign: 'center',
    outline: 'none',
  },
  sep: {
    fontSize: '14px',
    color: '#888',
  },
  unit: {
    fontSize: '14px',
    color: '#888',
  },
};

export default function DelayPicker({ minDelay, maxDelay, onChange }) {
  function handleMin(e) {
    const val = Math.max(0, Number(e.target.value) || 0);
    onChange(val, Math.max(val, maxDelay));
  }

  function handleMax(e) {
    const val = Math.max(0, Number(e.target.value) || 0);
    onChange(Math.min(minDelay, val), val);
  }

  return (
    <div style={s.root}>
      <span style={s.label}>Delay between groups:</span>
      <input
        type="number"
        min="0"
        value={minDelay}
        onChange={handleMin}
        style={s.input}
        aria-label="Minimum delay in seconds"
      />
      <span style={s.sep}>to</span>
      <input
        type="number"
        min="0"
        value={maxDelay}
        onChange={handleMax}
        style={s.input}
        aria-label="Maximum delay in seconds"
      />
      <span style={s.unit}>seconds</span>
    </div>
  );
}
