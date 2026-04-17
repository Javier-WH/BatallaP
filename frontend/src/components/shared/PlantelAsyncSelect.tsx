import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Select, Spin } from 'antd';
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
  size?: 'small' | 'middle' | 'large';
  style?: React.CSSProperties;
  placeholder?: string;
  dropdownMinWidth?: number;
}

interface OptionItem {
  value: number;
  label: string;
  plantel: Plantel;
}

const PlantelAsyncSelect: React.FC<PlantelAsyncSelectProps> = ({
  value,
  currentLabel,
  onChange,
  disabled,
  size = 'small',
  style,
  placeholder = 'Plantel',
  dropdownMinWidth = 400,
}) => {
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [fetching, setFetching] = useState(false);
  const fetchRef = useRef(0);

  // Fetch plantel details when value is provided but not in options (to display label)
  useEffect(() => {
    if (value && !options.some(o => o.value === value) && !currentLabel) {
      (async () => {
        try {
          const { data } = await api.get(`/planteles/by-id/${value}`).catch(() => ({ data: null }));
          if (data) {
            setOptions(prev => {
              if (prev.some(o => o.value === data.id)) return prev;
              return [...prev, { value: data.id, label: `${data.code} - ${data.name}`, plantel: data }];
            });
          }
        } catch {
          // ignore
        }
      })();
    }
  }, [value, options, currentLabel]);

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
          const items: OptionItem[] = (data || []).map((p: Plantel) => ({
            value: p.id,
            label: `${p.code} - ${p.name}`,
            plantel: p,
          }));
          setOptions(items);
        } catch (error) {
          console.error('Error searching planteles:', error);
          setOptions([]);
        } finally {
          if (fetchId === fetchRef.current) setFetching(false);
        }
      }, 300);
    };
  }, []);

  const handleSearch = useCallback((text: string) => {
    if (text) setFetching(true);
    debouncedFetch(text);
  }, [debouncedFetch]);

  const handleChange = useCallback((newValue: number | null) => {
    const selected = options.find(o => o.value === newValue);
    onChange(newValue ?? null, selected?.plantel);
  }, [onChange, options]);

  // Ensure the currently selected value has a label in options
  const finalOptions = useMemo(() => {
    if (value && currentLabel && !options.some(o => o.value === value)) {
      return [
        { value, label: currentLabel, plantel: { id: value, code: currentLabel, name: '' } },
        ...options,
      ];
    }
    return options;
  }, [value, currentLabel, options]);

  return (
    <Select
      value={value ?? undefined}
      onChange={handleChange}
      onSearch={handleSearch}
      placeholder={placeholder}
      size={size}
      showSearch
      allowClear
      filterOption={false}
      disabled={disabled}
      style={style}
      options={finalOptions}
      notFoundContent={fetching ? <Spin size="small" /> : 'Escribe para buscar...'}
      dropdownStyle={{ minWidth: dropdownMinWidth }}
      popupMatchSelectWidth={false}
      virtual
    />
  );
};

export default PlantelAsyncSelect;
