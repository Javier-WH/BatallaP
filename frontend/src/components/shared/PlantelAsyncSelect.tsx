import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import api from '@/services/api';

interface Plantel {
  id: number;
  code: string;
  name: string;
  state?: string;
}

interface PlantelAsyncSelectProps {
  value?: number | null;
  currentLabel?: string;
  onChange: (plantelId: number | null, plantel?: Plantel) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  placeholder?: string;
  dropdownMinWidth?: number;
}

const PlantelAsyncSelect: React.FC<PlantelAsyncSelectProps> = ({
  value,
  currentLabel,
  onChange,
  disabled,
  style,
  placeholder = 'Plantel',
  dropdownMinWidth = 400,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<Plantel[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [fetching, setFetching] = useState(false);
  const [selectedPlantel, setSelectedPlantel] = useState<Plantel | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fetchRef = useRef(0);

  // Fetch selected plantel details when value changes
  useEffect(() => {
    if (value && !selectedPlantel) {
      (async () => {
        try {
          const { data } = await api.get(`/planteles/by-id/${value}`).catch(() => ({ data: null }));
          if (data) {
            setSelectedPlantel(data);
          }
        } catch {
          // ignore
        }
      })();
    } else if (!value) {
      setSelectedPlantel(null);
    }
  }, [value, selectedPlantel]);

  // Also use currentLabel if available
  useEffect(() => {
    if (currentLabel && !selectedPlantel) {
      const [code, name] = currentLabel.split(' - ');
      if (code && name) {
        setSelectedPlantel({ id: value || 0, code, name });
      }
    }
  }, [currentLabel, selectedPlantel, value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const debouncedFetch = useMemo(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return (searchText: string) => {
      if (timeout) clearTimeout(timeout);
      fetchRef.current += 1;
      const fetchId = fetchRef.current;

      timeout = setTimeout(async () => {
        if (!searchText || searchText.length < 2) {
          setOptions([]);
          setFetching(false);
          return;
        }
        setFetching(true);
        try {
          const { data } = await api.get('/planteles/search', {
            params: { q: searchText, limit: 30 }
          });
          if (fetchId !== fetchRef.current) return;
          setOptions(data || []);
        } catch (error) {
          console.error('Error searching planteles:', error);
          setOptions([]);
        } finally {
          if (fetchId === fetchRef.current) setFetching(false);
        }
      }, 300);
    };
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    setSearchValue(text);
    debouncedFetch(text);
  }, [debouncedFetch]);

  const handleSelect = useCallback((plantel: Plantel) => {
    setSelectedPlantel(plantel);
    onChange(plantel.id, plantel);
    setIsOpen(false);
    setSearchValue('');
  }, [onChange]);

  const handleClear = useCallback(() => {
    setSelectedPlantel(null);
    onChange(null);
  }, [onChange]);

  const displayCode = selectedPlantel?.code || '';
  const displayName = selectedPlantel?.name || '';

  return (
    <div ref={dropdownRef} style={{ position: 'relative', ...style }}>
      {/* Trigger button */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        tabIndex={disabled ? -1 : 0}
        style={{
          padding: isFocused || isOpen ? '4px 8px' : '4px 8px',
          minHeight: '36px',
          height: '36px',
          backgroundColor: isFocused || isOpen ? (disabled ? '#f5f5f5' : '#fff') : 'transparent',
          border: '1px solid transparent',
          borderRadius: '4px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
          outline: 'none',
        }}
      >
        {selectedPlantel ? (
          <>
            <div style={{ fontSize: '12px', fontWeight: 500, color: '#666', lineHeight: 1.2 }}>
              {displayCode}
            </div>
            <div style={{ fontSize: '11px', color: '#999', lineHeight: 1.2 }}>
              {displayName}
            </div>
            {!disabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                style={{
                  position: 'absolute',
                  right: '-1px',
                  top: '-3px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#999',
                  padding: '0 4px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </>
        ) : (
          <span style={{ color: '#bfbfbf', fontSize: '13px' }}>{placeholder}</span>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            minWidth: dropdownMinWidth,
            maxHeight: '300px',
            backgroundColor: '#fff',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            marginTop: '4px',
            overflow: 'hidden',
          }}
        >
          {/* Search input in dropdown */}
          <div style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar plantel..."
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
              autoFocus
            />
          </div>

          {/* Options list */}
          <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
            {fetching ? (
              <div style={{ padding: '12px', textAlign: 'center', color: '#999' }}>
                Buscando...
              </div>
            ) : options.length === 0 && searchValue.length >= 2 ? (
              <div style={{ padding: '12px', textAlign: 'center', color: '#999' }}>
                No se encontraron resultados
              </div>
            ) : options.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', color: '#999' }}>
                Escribe para buscar...
              </div>
            ) : (
              options.map((plantel) => (
                <div
                  key={plantel.id}
                  onClick={() => handleSelect(plantel)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f5f5f5',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                >
                  <div style={{ fontSize: '12px', fontWeight: 500, color: '#333' }}>
                    {plantel.code}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>
                    {plantel.name}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlantelAsyncSelect;
