import React, { useState, useEffect, useCallback } from 'react';
import { Modal, InputNumber, Select, DatePicker, Tag, Space, Divider, Statistic, Checkbox, message } from 'antd';
import { DollarOutlined, CalculatorOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getRatesAtDate,
  type RateAtDate,
} from '@/services/paymentsService';

interface ExchangeRateBarProps {
  usdRate: number | null;
  eurRate: number | null;
  rateDate: string | null;
}

const ExchangeRateBar: React.FC<ExchangeRateBarProps> = ({ usdRate, eurRate, rateDate }) => {
  const [calcOpen, setCalcOpen] = useState(false);
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
    if (calcOpen) {
      setCalcDate(dayjs());
      loadRatesForDate(dayjs());
    }
  }, [calcOpen, loadRatesForDate]);

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
      if (calcDirection === 'from_ves') {
        result = calcAmount / r.rate;
      } else {
        result = calcAmount * r.rate;
      }
    }
    return { ...r, result };
  });

  const availableCurrencies = calcRates
    .filter(r => r.rate !== null)
    .map(r => ({ value: r.currency, label: `${r.currency} (${r.name})` }));

  return (
    <>
      {/* Bar with rates — clickable to open calculator */}
      <div
        className="hidden lg:flex items-center gap-3 cursor-pointer rounded-xl px-3 py-1.5 transition-all hover:bg-slate-50"
        onClick={() => setCalcOpen(true)}
        title="Click para abrir calculadora de conversión"
      >
        <DollarOutlined style={{ color: 'var(--color-text-muted)' }} />
        <div className="flex items-center gap-4">
          {/* USD in green */}
          <div className="flex flex-col">
            <span className="text-[9px] font-bold uppercase tracking-wider text-green-600 leading-none mb-0.5">
              USD BCV
            </span>
            <span className="text-sm font-bold text-green-600 leading-tight">
              {usdRate !== null ? usdRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
            </span>
          </div>
          {/* EUR in blue */}
          <div className="flex flex-col">
            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 leading-none mb-0.5">
              EUR BCV
            </span>
            <span className="text-sm font-bold text-blue-600 leading-tight">
              {eurRate !== null ? eurRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
            </span>
          </div>
          {/* Date */}
          {rateDate && (
            <span className="text-[10px] text-slate-400 font-medium">
              {dayjs(rateDate).format('DD/MM/YYYY')}
            </span>
          )}
          <CalculatorOutlined style={{ color: 'var(--color-text-muted)', fontSize: 12 }} />
        </div>
      </div>

      {/* Calculator Modal */}
      <Modal
        title={
          <Space>
            <CalculatorOutlined />
            <span>Calculadora de Conversión</span>
          </Space>
        }
        open={calcOpen}
        onCancel={() => setCalcOpen(false)}
        footer={null}
        width={480}
      >
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
      </Modal>
    </>
  );
};

export default ExchangeRateBar;
