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
  onChange: (ids: number[]) => void;
  placeholder?: string;
  width?: number;
}

/**
 * Multi-select with filter dropdown and chip display.
 * Each selected plantel shows as a chip with its number (1, 2, 3...) and an × to remove.
 */
const PlantelMultiSelect: React.FC<PlantelMultiSelectProps> = ({
  planteles,
  selectedIds,
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
      setDropdownPos({ top: rect.bottom + 2, left: rect.left, width: Math.max(width, 220) });
    } else {
      setDropdownPos(null);
    }
  }, [open, width]);

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const scrollHandler = () => setOpen(false);
    document.addEventListener('mousedown', handler);
    document.addEventListener('scroll', scrollHandler, true);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('scroll', scrollHandler, true);
    };
  }, [open]);

  const filtered = planteles.filter(p =>
    p.name.toLowerCase().includes(filter.toLowerCase()) ||
    p.code.toLowerCase().includes(filter.toLowerCase())
  );

  const toggle = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const remove = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter(x => x !== id));
  };

  const selectedPlanteles = selectedIds.map((id, idx) => ({
    ...planteles.find(p => p.id === id),
    number: idx + 1,
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
        {selectedPlanteles.map(p => (
          <span
            key={p.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              background: '#EFE3C7',
              color: '#A9814B',
              borderRadius: 3,
              padding: '0 4px',
              fontSize: 10,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={p.name}
          >
            <span style={{ fontWeight: 700 }}>#{p.number}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}>{p.name}</span>
            <span
              onClick={(e) => remove(p.id, e)}
              style={{ cursor: 'pointer', fontWeight: 700, marginLeft: 1, flexShrink: 0 }}
            >
              ×
            </span>
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
              return (
                <div
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    cursor: 'pointer',
                    background: isSelected ? '#EFE3C7' : 'transparent',
                    color: '#1E2A44',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#F7F4EC'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {isSelected && <span style={{ color: '#A9814B', fontWeight: 700 }}>✓</span>}
                  <span style={{ fontWeight: 600, color: '#A9814B', minWidth: 28 }}>{p.code}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
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
