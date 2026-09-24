import React, { useState } from 'react';
import { Modal, Space } from 'antd';
import { DollarOutlined, CalculatorOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import ExchangeRateCalculator from '@/components/ExchangeRateCalculator';

interface ExchangeRateBarProps {
  usdRate: number | null;
  eurRate: number | null;
  rateDate: string | null;
}

const ExchangeRateBar: React.FC<ExchangeRateBarProps> = ({ usdRate, eurRate, rateDate }) => {
  const [calcOpen, setCalcOpen] = useState(false);

  return (
    <>
      {/* Bar with rates — clickable to open calculator (desktop only) */}
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

      {/* Compact rates — always visible on small screens, opens the calculator */}
      <div
        className="lg:hidden flex items-center gap-1.5 cursor-pointer rounded-lg px-2 py-1 transition-all hover:bg-slate-50"
        onClick={() => setCalcOpen(true)}
        title="Click para abrir calculadora de conversión"
      >
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] font-bold text-green-600">
            $ {usdRate !== null ? usdRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
          </span>
          <span className="text-[11px] font-bold text-blue-600">
            € {eurRate !== null ? eurRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
          </span>
        </div>
        <CalculatorOutlined style={{ color: 'var(--color-text-muted)', fontSize: 11 }} />
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
        <ExchangeRateCalculator active={calcOpen} />
      </Modal>
    </>
  );
};

export default ExchangeRateBar;
