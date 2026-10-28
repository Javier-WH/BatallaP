import React, { useEffect, useState } from 'react';
import { Button, Card, DatePicker, Input, InputNumber, Select, Tag, Alert, Spin } from 'antd';
import { BankOutlined, CheckCircleFilled, CloseCircleFilled, SearchOutlined } from '@ant-design/icons';
import api from '@/services/api';
import { listBanks } from '@/services/bankService';
import type { Bank } from '@/services/bankService';
import dayjs, { Dayjs } from 'dayjs';

interface VerificationResult {
  found: boolean;
  message?: string;
  movement?: {
    raw: string;
    description: string;
    reference: string | null;
    cedula: string | null;
    bankCode: string | null;
    amount: number | null;
    date: string | null;
    time: string | null;
  };
}

const BankVerification: React.FC = () => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState<string | undefined>();
  const [last4, setLast4] = useState('');
  const [cedula, setCedula] = useState('');
  const [date, setDate] = useState<Dayjs | null>(dayjs());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listBanks({ active: true }).then(setBanks).catch(() => {});
  }, []);

  const canVerify = /^\d{4}$/.test(last4) && cedula.trim().length >= 6;

  const verify = async () => {
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const { data } = await api.post<VerificationResult>('/bank-verification/verify', {
        bankCode,
        last4,
        cedula: cedula.trim(),
        date: date?.format('YYYY-MM-DD'),
      }, { timeout: 120000 });
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al verificar el pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Card
        title={
          <span className="flex items-center gap-2">
            <BankOutlined /> Verificación de pagos — Venezolano de Crédito
          </span>
        }
      >
        <Alert
          type="info"
          showIcon
          className="mb-4"
          message="Consulta los movimientos de la cuenta institucional en la banca en línea y confirma si una transferencia fue recibida."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Banco emisor</label>
            <Select
              className="w-full"
              placeholder="Cualquier banco"
              allowClear
              showSearch
              optionFilterProp="label"
              value={bankCode}
              onChange={v => setBankCode(v)}
              options={banks.map(b => ({ value: b.code, label: `${b.code} — ${b.shortName || b.name}` }))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Últimos 4 dígitos de la referencia</label>
            <Input
              maxLength={4}
              placeholder="1567"
              value={last4}
              onChange={e => setLast4(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Cédula del pagador</label>
            <InputNumber
              className="w-full"
              placeholder="18894410"
              controls={false}
              value={cedula ? Number(cedula) : null}
              onChange={v => setCedula(v == null ? '' : String(v))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha del pago</label>
            <DatePicker className="w-full" value={date} onChange={setDate} format="DD/MM/YYYY" allowClear />
          </div>
        </div>

        <Button
          type="primary"
          icon={<SearchOutlined />}
          className="mt-5"
          disabled={!canVerify || loading}
          onClick={verify}
        >
          {loading ? 'Consultando banca en línea…' : 'Verificar'}
        </Button>
        {loading && (
          <div className="mt-3 flex items-center gap-2 text-slate-500 text-sm">
            <Spin size="small" /> Esto puede tardar hasta un minuto mientras se consulta la cuenta.
          </div>
        )}
        {error && <Alert type="error" showIcon className="mt-4" message={error} />}

        {result && (
          <div className={`mt-6 rounded-xl border p-4 ${result.found ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              {result.found
                ? <CheckCircleFilled className="text-emerald-600 text-lg" />
                : <CloseCircleFilled className="text-rose-600 text-lg" />}
              <span className={`font-bold ${result.found ? 'text-emerald-800' : 'text-rose-800'}`}>
                {result.found ? 'Pago encontrado' : 'Pago no encontrado'}
              </span>
              {result.found && result.movement?.amount != null && (
                <Tag color="green" className="text-base font-bold ml-1">
                  Bs. {result.movement.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </Tag>
              )}
            </div>
            {result.movement && (
              <div className="text-sm text-slate-700 space-y-1">
                <div><strong>Descripción:</strong> {result.movement.description}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {result.movement.reference && <span><strong>Referencia:</strong> {result.movement.reference}</span>}
                  {result.movement.cedula && <span><strong>Cédula:</strong> V{result.movement.cedula}</span>}
                  {result.movement.bankCode && <span><strong>Banco:</strong> {result.movement.bankCode}</span>}
                  {result.movement.time && <span><strong>Hora:</strong> {result.movement.time}</span>}
                  {result.movement.date && <span><strong>Fecha:</strong> {dayjs(result.movement.date).format('DD/MM/YYYY')}</span>}
                </div>
              </div>
            )}
            {result.message && <div className="text-sm text-slate-600 mt-1">{result.message}</div>}
          </div>
        )}
      </Card>
    </div>
  );
};

export default BankVerification;
