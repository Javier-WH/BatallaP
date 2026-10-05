import React, { useState, useEffect, useCallback } from 'react';
import { InputNumber, DatePicker, Tag, Space, Divider, Statistic, Checkbox, message } from 'antd';
import dayjs from 'dayjs';
import {
  getRatesAtDate,
  type RateAtDate,
} from '@/services/paymentsService';

interface ExchangeRateCalculatorProps {
  /** When provided, rates are (re)loaded every time it turns true (e.g. modal opened). */
  active?: boolean;
}

const BsCoin: React.FC<{ size?: number }> = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="21" fill="#B08D2B" />
    <circle cx="24" cy="24" r="16.5" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.6" />
    <text x="24" y="30.5" textAnchor="middle" fontSize="17" fontWeight="bold" fill="#fff" fontFamily="Arial, sans-serif">Bs</text>
  </svg>
);

const DivisaCoin: React.FC<{ size?: number }> = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" version="1" xmlns="http://www.w3.org/2000/svg" enableBackground="new 0 0 48 48" fill="#000000">
    <circle fill="#3F51B5" cx="18" cy="18" r="15" />
    <path fill="#FFF59D" d="M20.3,16v1.7h-3.8v1.4h3.8v1.7h-3.8c0,0.6,0.1,1.2,0.3,1.6c0.2,0.4,0.4,0.8,0.7,1c0.3,0.3,0.7,0.4,1.1,0.6 c0.4,0.1,0.9,0.2,1.4,0.2c0.4,0,0.7,0,1.1-0.1c0.4-0.1,0.7-0.1,1-0.3l0.4,2.7c-0.4,0.1-0.9,0.2-1.4,0.2c-0.5,0.1-1,0.1-1.5,0.1 c-0.9,0-1.8-0.1-2.6-0.4c-0.8-0.2-1.5-0.6-2-1.1c-0.6-0.5-1-1.1-1.4-1.9c-0.3-0.7-0.5-1.6-0.5-2.6h-1.9v-1.7h1.9v-1.4h-1.9V16h1.9 c0.1-1,0.3-1.8,0.6-2.6c0.4-0.7,0.8-1.4,1.4-1.9c0.6-0.5,1.3-0.9,2.1-1.1c0.8-0.3,1.7-0.4,2.6-0.4c0.4,0,0.9,0,1.3,0.1 c0.4,0.1,0.9,0.1,1.3,0.3l-0.4,2.7c-0.3-0.1-0.6-0.2-1-0.3c-0.4-0.1-0.7-0.1-1.1-0.1c-0.5,0-1,0.1-1.4,0.2c-0.4,0.1-0.8,0.3-1,0.6 c-0.3,0.3-0.5,0.6-0.7,1s-0.3,0.9-0.3,1.5H20.3z" />
    <circle fill="#4CAF50" cx="30" cy="30" r="15" />
    <path fill="#ffffff" d="M28.4,27c0.1,0.2,0.2,0.4,0.4,0.6c0.2,0.2,0.4,0.4,0.7,0.5c0.3,0.2,0.7,0.3,1.1,0.5c0.7,0.3,1.4,0.6,2,0.9 c0.6,0.3,1.1,0.7,1.5,1.1c0.4,0.4,0.8,0.9,1,1.4c0.2,0.5,0.4,1.2,0.4,1.9c0,0.7-0.1,1.3-0.3,1.8c-0.2,0.5-0.5,1-0.9,1.4 s-0.9,0.7-1.4,0.9c-0.6,0.2-1.2,0.4-1.8,0.5v2.2h-1.8v-2.2c-0.6-0.1-1.2-0.2-1.8-0.4s-1.1-0.5-1.5-1c-0.5-0.4-0.8-1-1.1-1.6 c-0.3-0.6-0.4-1.4-0.4-2.3h3.3c0,0.5,0.1,1,0.2,1.3c0.1,0.4,0.3,0.6,0.6,0.9c0.2,0.2,0.5,0.4,0.8,0.5c0.3,0.1,0.6,0.1,0.9,0.1 c0.4,0,0.7,0,0.9-0.1c0.3-0.1,0.5-0.2,0.7-0.4c0.2-0.2,0.3-0.4,0.4-0.6c0.1-0.2,0.1-0.5,0.1-0.8c0-0.3,0-0.6-0.1-0.8 c-0.1-0.2-0.2-0.5-0.4-0.7s-0.4-0.4-0.7-0.5c-0.3-0.2-0.7-0.3-1.1-0.5c-0.7-0.3-1.4-0.6-2-0.9c-0.6-0.3-1.1-0.7-1.5-1.1 c-0.4-0.4-0.8-0.9-1-1.4c-0.2-0.5-0.4-1.2-0.4-1.9c0-0.6,0.1-1.2,0.3-1.7c0.2-0.5,0.5-1,0.9-1.4c0.4-0.4,0.9-0.7,1.4-1 c0.5-0.2,1.2-0.4,1.8-0.5v-2.4h1.8v2.4c0.6,0.1,1.2,0.3,1.8,0.6c0.5,0.3,1,0.6,1.3,1.1c0.4,0.4,0.7,1,0.9,1.6c0.2,0.6,0.3,1.3,0.3,2 h-3.3c0-0.9-0.2-1.6-0.6-2c-0.4-0.4-0.9-0.7-1.5-0.7c-0.3,0-0.6,0.1-0.9,0.2c-0.2,0.1-0.4,0.2-0.6,0.4c-0.2,0.2-0.3,0.4-0.3,0.6 c-0.1,0.2-0.1,0.5-0.1,0.8C28.3,26.5,28.4,26.8,28.4,27z" />
  </svg>
);

const CURRENCY_META: Record<string, { symbol: string; color: string }> = {
  USD: { symbol: '$', color: '#4CAF50' },
  EUR: { symbol: '€', color: '#3F51B5' },
};

const CurrencySymbol: React.FC<{ currency: string; opacity?: number }> = ({ currency, opacity = 1 }) => {
  const meta = CURRENCY_META[currency];
  if (!meta) return <>{currency}</>;
  return <span style={{ color: meta.color, opacity }}>{meta.symbol}</span>;
};

const ExchangeRateCalculator: React.FC<ExchangeRateCalculatorProps> = ({ active }) => {
  const [calcDate, setCalcDate] = useState<dayjs.Dayjs>(dayjs());
  const [calcRates, setCalcRates] = useState<RateAtDate[]>([]);
  const [, setCalcLoading] = useState(false);
  const [calcAmount, setCalcAmount] = useState<number>(10000);
  const [calcDirection, setCalcDirection] = useState<'from_ves' | 'to_ves'>('from_ves');
  const [calcCurrencies, setCalcCurrencies] = useState<string[]>(['USD', 'EUR']);

  const loadRatesForDate = useCallback(async (date: dayjs.Dayjs) => {
    setCalcLoading(true);
    try {
      const result = await getRatesAtDate(date.format('YYYY-MM-DD'));
      setCalcRates(result.rates);
    } catch {
      message.error('Error al cargar tipos de cambio');
    } finally {
      setCalcLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active === undefined || active) {
      setCalcDate(dayjs());
      loadRatesForDate(dayjs());
    }
  }, [active, loadRatesForDate]);

  const handleCalcDateChange = (date: dayjs.Dayjs | null) => {
    if (date) {
      setCalcDate(date);
      loadRatesForDate(date);
    }
  };

  // Find rates for selected currencies
  const selectedRates = calcRates.filter(r => calcCurrencies.includes(r.currency) && r.rate !== null);

  // Calculate conversion for each selected currency
  const calcResults = selectedRates.map(r => {
    let result: number | null = null;
    if (r.rate !== null && r.rate > 0 && calcAmount > 0) {
      result = calcDirection === 'from_ves' ? calcAmount / r.rate : calcAmount * r.rate;
    }
    return { ...r, result };
  });

  const availableCurrencies = calcRates
    .filter(r => r.rate !== null)
    .map(r => ({ value: r.currency, label: <><CurrencySymbol currency={r.currency} /> ({r.name})</> }));

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {/* Date picker */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">
          Fecha del tipo de cambio
        </label>
        <DatePicker
          value={calcDate}
          onChange={handleCalcDateChange}
          format="DD/MM/YYYY"
          style={{ width: '100%' }}
          allowClear={false}
        />
        {calcRates.length > 0 && (
          <div className="mt-1 text-xs text-slate-400">
            {calcRates.filter(r => r.rate !== null).map(r => (
              <span key={r.currency} className="mr-3">
                <CurrencySymbol currency={r.currency} />: <strong>{r.rate?.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong> ({r.date ? dayjs(r.date).format('DD/MM/YYYY') : '—'})
              </span>
            ))}
          </div>
        )}
      </div>

      <Divider style={{ margin: '8px 0' }} />

      {/* Direction selector */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">
          Dirección de conversión
        </label>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '6px 0' }}>
          <div style={{ textAlign: 'center', lineHeight: 1 }}>
            <BsCoin />
            <div className="text-[10px] font-bold text-slate-500 mt-1">Bs</div>
          </div>
          <button
            type="button"
            onClick={() => setCalcDirection(d => d === 'from_ves' ? 'to_ves' : 'from_ves')}
            title="Invertir dirección"
            aria-label="Invertir dirección de conversión"
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: calcDirection === 'from_ves' ? 'var(--color-accent, #1a3a5c)' : '#B08D2B',
              transition: 'color 0.25s ease',
            }}
          >
            <svg
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              style={{
                transform: calcDirection === 'to_ves' ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.25s ease',
              }}
            >
              <path
                d="M4 12h15m0 0-5.5-5.5M19 12l-5.5 5.5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div style={{ textAlign: 'center', lineHeight: 1 }}>
            <DivisaCoin />
            <div className="text-[10px] font-bold text-slate-500 mt-1">
              <CurrencySymbol currency="USD" /> / <CurrencySymbol currency="EUR" />
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
          {calcDirection === 'from_ves'
            ? <>Bs → Divisa (¿Cuántos <CurrencySymbol currency="USD" />/<CurrencySymbol currency="EUR" /> son X Bs?)</>
            : <>Divisa → Bs (¿Cuántos Bs son X <CurrencySymbol currency="USD" />/<CurrencySymbol currency="EUR" />?)</>}
        </div>
      </div>

      {/* Currency checkboxes */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">
          Monedas
        </label>
        <Checkbox.Group
          value={calcCurrencies}
          onChange={(values) => setCalcCurrencies(values as string[])}
          options={availableCurrencies.length > 0 ? availableCurrencies : [
            { value: 'USD', label: <CurrencySymbol currency="USD" /> },
            { value: 'EUR', label: <CurrencySymbol currency="EUR" /> },
          ]}
        />
      </div>

      {/* Amount input */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">
          {calcDirection === 'from_ves' ? 'Monto en Bolívares (Bs)' : `Monto en divisa`}
        </label>
        <InputNumber
          value={calcAmount || undefined}
          onChange={(v) => setCalcAmount(v ?? 0)}
          min={0}
          step={100}
          style={{ width: '100%' }}
          formatter={(value) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
          parser={(value) => Number(value?.replace(/,/g, '') || 0)}
          placeholder="0"
        />
      </div>

      {/* Results — one per selected currency */}
      {calcResults.length > 0 ? (
        <div className="space-y-3">
          {calcResults.map(r => (
            <div key={r.currency} className="bg-slate-50 rounded-xl p-4">
              <Statistic
                title={calcDirection === 'from_ves'
                  ? <>Equivalente en <CurrencySymbol currency={r.currency} /></>
                  : <>Equivalente en Bolívares (Bs) — <CurrencySymbol currency={r.currency} /></>}
                value={r.result !== null ? r.result : '—'}
                precision={r.result !== null ? 2 : undefined}
                prefix={calcDirection === 'from_ves'
                  ? <CurrencySymbol currency={r.currency} />
                  : <span style={{ color: CURRENCY_META[r.currency]?.color }}>Bs </span>}
                valueStyle={{ fontWeight: 700 }}
              />
              <div className="mt-1 text-xs text-slate-400">
                Tasa: <strong>{r.rate?.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs/<CurrencySymbol currency={r.currency} /></strong> — Fecha: {r.date ? dayjs(r.date).format('DD/MM/YYYY') : '—'}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Tag color="orange">No hay tasa de cambio disponible para esta fecha y moneda</Tag>
      )}
    </Space>
  );
};

export default ExchangeRateCalculator;
