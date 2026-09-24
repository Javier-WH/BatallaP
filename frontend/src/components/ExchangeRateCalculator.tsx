import React, { useState, useEffect, useCallback } from 'react';
import { InputNumber, Select, DatePicker, Tag, Space, Divider, Statistic, Checkbox, message } from 'antd';
import dayjs from 'dayjs';
import {
  getRatesAtDate,
  type RateAtDate,
} from '@/services/paymentsService';

interface ExchangeRateCalculatorProps {
  /** When provided, rates are (re)loaded every time it turns true (e.g. modal opened). */
  active?: boolean;
}

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
    .map(r => ({ value: r.currency, label: `${r.currency} (${r.name})` }));

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
                {r.currency}: <strong>{r.rate?.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong> ({r.date ? dayjs(r.date).format('DD/MM/YYYY') : '—'})
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
        <Select
          value={calcDirection}
          onChange={setCalcDirection}
          style={{ width: '100%' }}
          options={[
            { value: 'from_ves', label: 'Bs → Divisa (¿Cuántos USD/EUR son X Bs?)' },
            { value: 'to_ves', label: 'Divisa → Bs (¿Cuántos Bs son X USD/EUR?)' },
          ]}
        />
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
            { value: 'USD', label: 'USD' },
            { value: 'EUR', label: 'EUR' },
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
                title={calcDirection === 'from_ves' ? `Equivalente en ${r.currency}` : `Equivalente en Bolívares (Bs) — ${r.currency}`}
                value={r.result !== null ? r.result : '—'}
                precision={r.result !== null ? 2 : undefined}
                prefix={calcDirection === 'from_ves' ? `${r.currency} ` : 'Bs '}
                valueStyle={{ fontWeight: 700 }}
              />
              <div className="mt-1 text-xs text-slate-400">
                Tasa: <strong>{r.rate?.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs/{r.currency}</strong> — Fecha: {r.date ? dayjs(r.date).format('DD/MM/YYYY') : '—'}
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
