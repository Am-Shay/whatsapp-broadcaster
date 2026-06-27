import React, { useEffect, useRef, useState } from 'react';
import Tooltip from './Tooltip';

const s = {
  root: { position: 'relative' },
  trigger: {
    width: '100%',
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#111',
    userSelect: 'none',
    boxSizing: 'border-box',
  },
  triggerDisabled: { opacity: 0.6, cursor: 'default' },
  triggerArrow: { fontSize: '10px', color: '#9ca3af', marginLeft: '8px', flexShrink: 0 },
  chipArea: {
    display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', minHeight: '22px',
  },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    background: '#dcfce7', color: '#15803d', border: '1px solid #86efac',
    borderRadius: '20px', padding: '3px 6px 3px 10px', fontSize: '13px', fontWeight: '500',
    maxWidth: '200px',
  },
  chipName: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chipRemove: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#15803d',
    fontSize: '15px', lineHeight: 1, padding: '0 2px', flexShrink: 0, fontWeight: '700',
  },
  noGroups: { fontSize: '13px', color: '#9ca3af', lineHeight: '22px' },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    background: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: '10px',
    boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
    zIndex: 200,
    overflow: 'hidden',
  },
  searchRow: {
    padding: '10px 10px 8px',
    borderBottom: '1px solid #f3f4f6',
  },
  searchInput: {
    width: '100%',
    padding: '7px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  actionsRow: {
    display: 'flex',
    gap: '6px',
    padding: '6px 10px',
    borderBottom: '1px solid #f3f4f6',
  },
  actionBtn: {
    padding: '4px 10px',
    fontSize: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: '#f9fafb',
    cursor: 'pointer',
    color: '#374151',
    fontWeight: '500',
  },
  list: { maxHeight: '240px', overflowY: 'auto' },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 14px',
    cursor: 'pointer',
    borderBottom: '1px solid #f9fafb',
    fontSize: '14px',
    color: '#111',
    userSelect: 'none',
  },
  itemChecked: { background: '#f0fdf4' },
  checkbox: { width: '15px', height: '15px', accentColor: '#25D366', flexShrink: 0, cursor: 'pointer' },
  empty: { padding: '16px', textAlign: 'center', color: '#aaa', fontSize: '13px' },
  errorRow: {
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#dc2626',
  },
  retryBtn: {
    background: 'none',
    border: 'none',
    color: '#2563eb',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontSize: '13px',
    padding: 0,
    marginLeft: 'auto',
  },
};

export default function GroupSelector({ selectedGroups, onChange, onGroupsLoaded }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  async function fetchGroups() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/groups');
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data = await res.json();
      setGroups(data);
      onGroupsLoaded?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchGroups(); }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Auto-focus search, clear it when closing
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 40);
    else setSearch('');
  }, [open]);

  const filtered = search.trim()
    ? groups.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
    : groups;

  const allFilteredSelected = filtered.length > 0 && filtered.every((g) => selectedGroups.has(g.id));

  function toggle(id) {
    const next = new Set(selectedGroups);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange(next);
  }

  function selectAll() {
    const next = new Set(selectedGroups);
    filtered.forEach((g) => next.add(g.id));
    onChange(next);
  }

  function clearAll() {
    onChange(new Set());
  }

  const disabled = loading || !!error;

  const triggerLabel = loading
    ? 'Loading groups…'
    : error
    ? 'Failed to load groups'
    : selectedGroups.size === 0
    ? 'Select groups…'
    : `${selectedGroups.size} group${selectedGroups.size !== 1 ? 's' : ''} selected`;

  return (
    <div ref={rootRef} style={s.root}>
      <button
        type="button"
        style={{ ...s.trigger, ...(disabled ? s.triggerDisabled : {}) }}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
      >
        <span>{triggerLabel}</span>
        <span style={s.triggerArrow}>{open ? '▲' : '▼'}</span>
      </button>

      {!loading && !error && (
        <div style={s.chipArea}>
          {selectedGroups.size === 0 ? (
            <span style={s.noGroups}>No groups selected</span>
          ) : (
            [...selectedGroups].map((id) => {
              const name = groups.find((g) => g.id === id)?.name ?? id;
              return (
                <div key={id} style={s.chip} title={name}>
                  <span style={s.chipName}>{name}</span>
                  <Tooltip text="Remove this group from selection" style={{ flexShrink: 0 }}>
                    <button
                      type="button"
                      style={s.chipRemove}
                      onClick={() => toggle(id)}
                      aria-label={`Remove ${name}`}
                    >
                      ×
                    </button>
                  </Tooltip>
                </div>
              );
            })
          )}
        </div>
      )}

      {open && (
        <div style={s.dropdown}>
          <div style={s.searchRow}>
            <input
              ref={searchRef}
              style={s.searchInput}
              placeholder="Search groups…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {error ? (
            <div style={s.errorRow}>
              {error}
              <button style={s.retryBtn} onClick={() => { fetchGroups(); setOpen(false); }}>
                Retry
              </button>
            </div>
          ) : (
            <>
              <div style={s.actionsRow}>
                <Tooltip text="Select all visible groups">
                  <button type="button" style={s.actionBtn} onClick={selectAll}>
                    {allFilteredSelected ? 'Deselect all' : 'Select all'}
                    {search && ' matches'}
                  </button>
                </Tooltip>
                {selectedGroups.size > 0 && (
                  <Tooltip text="Deselect all groups">
                    <button type="button" style={s.actionBtn} onClick={clearAll}>Clear all</button>
                  </Tooltip>
                )}
              </div>

              <div style={s.list}>
                {filtered.length === 0 ? (
                  <div style={s.empty}>{search ? 'No matches' : 'No groups found'}</div>
                ) : (
                  filtered.map((g) => {
                    const checked = selectedGroups.has(g.id);
                    return (
                      <div
                        key={g.id}
                        style={{ ...s.item, ...(checked ? s.itemChecked : {}) }}
                        onClick={() => toggle(g.id)}
                      >
                        <input
                          type="checkbox"
                          style={s.checkbox}
                          checked={checked}
                          onChange={() => toggle(g.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {g.name}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
