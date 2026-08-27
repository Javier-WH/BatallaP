import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Plantel {
  id: number;
  code: string;
  name: string;
}

interface PlantelMultiSelectProps {
  planteles: Plantel[];
  selectedIds: number[];
  systemIds?: number[];      // planteles from system grades (cannot be removed, only reordered)
  onChange: (ids: number[]) => void;
  placeholder?: string;
  width?: number;
}

/**
 * Multi-select with filter dropdown and chip display.
 * Each selected plantel shows as a chip with its number (1, 2, 3...) and ↑/↓ to reorder.
 * System planteles (in systemIds) cannot be removed, only reordered.
 */
const PlantelMultiSelect: React.FC<PlantelMultiSelectProps> = ({
  planteles,
  selectedIds,
  systemIds = [],
  onChange,
  placeholder = 'Buscar plantel…',
  width = 200,
}) => {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Recalculate dropdown position when opening
  useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownWidth = 360;
      const left = Math.min(rect.left, window.innerWidth - dropdownWidth - 8);
      setDropdownPos({ top: rect.bottom + 2, left: Math.max(8, left), width: dropdownWidth });
    } else {
      setDropdownPos(null);
    }
  }, [open]);

  // Close on outside click, Escape, or scroll from the table
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      // Click inside the container → keep open
      if (containerRef.current && containerRef.current.contains(e.target as Node)) return;
      // Click inside the portal dropdown → keep open (don't close on item click, toggle handles that)
      const dropdown = document.querySelector('[data-plantel-dropdown]');
      if (dropdown && dropdown.contains(e.target as Node)) return;
      // Otherwise close
      setOpen(false);
    };
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setFilter('');
      }
    };
    const scrollHandler = (e: Event) => {
      const dropdown = document.querySelector('[data-plantel-dropdown]');
      if (dropdown && dropdown.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escapeHandler);
    document.addEventListener('scroll', scrollHandler, true);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escapeHandler);
      document.removeEventListener('scroll', scrollHandler, true);
    };
  }, [open]);

  const filtered = planteles.filter(p =>
    p.name.toLowerCase().includes(filter.toLowerCase()) ||
    p.code.toLowerCase().includes(filter.toLowerCase())
  );

  const toggle = (id: number) => {
    if (selectedIds.includes(id)) {
      // Don't allow removing system planteles
      if (systemIds.includes(id)) return;
      onChange(selectedIds.filter(x => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
    // Close dropdown after selecting
    setOpen(false);
    setFilter('');
  };

  const remove = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (systemIds.includes(id)) return;
    onChange(selectedIds.filter(x => x !== id));
  };

  const moveUp = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (idx === 0) return;
    const next = [...selectedIds];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  };

  const moveDown = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (idx === selectedIds.length - 1) return;
    const next = [...selectedIds];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(next);
  };

  const selectedPlanteles = selectedIds.map((id, idx) => ({
    ...planteles.find(p => p.id === id),
    number: idx + 1,
    isSystem: systemIds.includes(id),
  })).filter(p => p.id);

  return (
    <div ref={containerRef} style={{ position: 'relative', width }}>
      {/* Chips + input */}
      <div
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
        style={{
          minHeight: 24,
          padding: '2px 4px',
          border: 'none',
          background: 'transparent',
          cursor: 'text',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'center',
          width: '100%',
        }}
      >
        {selectedPlanteles.map((p, idx) => (
          <span
            key={p.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              background: p.isSystem ? '#E8E0D0' : '#EFE3C7',
              color: '#A9814B',
              borderRadius: 3,
              padding: '0 2px',
              fontSize: 10,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              maxWidth: '100%',
              overflow: 'hidden',
            }}
            title={p.name + (p.isSystem ? ' (sistema)' : '')}
          >
            <span style={{ fontWeight: 700 }}>#{p.number}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 230 }}>{p.name}</span>
            {/* Reorder buttons */}
            <span
              onClick={(e) => moveUp(idx, e)}
              style={{ cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1, fontWeight: 700, flexShrink: 0, padding: '0 1px' }}
              title="Mover arriba"
            >▲</span>
            <span
              onClick={(e) => moveDown(idx, e)}
              style={{ cursor: idx === selectedPlanteles.length - 1 ? 'default' : 'pointer', opacity: idx === selectedPlanteles.length - 1 ? 0.3 : 1, fontWeight: 700, flexShrink: 0, padding: '0 1px' }}
              title="Mover abajo"
            >▼</span>
            {/* Remove button — only for non-system planteles */}
            {!p.isSystem && (
              <span
                onClick={(e) => remove(p.id, e)}
                style={{ cursor: 'pointer', fontWeight: 700, marginLeft: 1, flexShrink: 0 }}
                title="Quitar"
              >×</span>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={filter}
          onChange={e => { setFilter(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selectedIds.length === 0 ? placeholder : ''}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 11,
            fontFamily: 'inherit',
            color: '#1E2A44',
            padding: 0,
            minWidth: 40,
            flex: 1,
          }}
        />
      </div>

      {/* Dropdown — rendered via portal to escape overflow:auto containers */}
      {open && dropdownPos && createPortal(
        <div
          data-plantel-dropdown="true"
          onScroll={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            zIndex: 99999,
            background: '#fff',
            border: '1px solid #DDD5C0',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            maxHeight: 200,
            overflowY: 'auto',
            width: dropdownPos.width,
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: 11, color: '#8B93A6' }}>Sin resultados</div>
          ) : (
            filtered.map(p => {
              const isSelected = selectedIds.includes(p.id);
              const isSystem = systemIds.includes(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  style={{
                    padding: '5px 12px',
                    fontSize: 12,
                    cursor: isSystem && isSelected ? 'default' : 'pointer',
                    background: isSelected ? '#EFE3C7' : 'transparent',
                    color: '#1E2A44',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#F7F4EC'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {isSelected
                    ? <span style={{ color: '#A9814B', fontWeight: 700, flex: '0 0 14px' }}>✓</span>
                    : <span style={{ flex: '0 0 14px' }}>&nbsp;</span>}
                  <span style={{ fontWeight: 600, color: '#A9814B', flex: '0 0 60px' }}>{p.code}</span>
                  <span style={{ flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  {isSystem && isSelected && <span style={{ fontSize: 9, color: '#8B93A6', flexShrink: 0, fontStyle: 'italic' }}>sistema</span>}
                </div>
              );
            })
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default React.memo(PlantelMultiSelect);
