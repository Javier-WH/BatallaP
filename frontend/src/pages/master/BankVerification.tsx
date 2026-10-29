import React, { useEffect, useState } from 'react';
import { Button, Card, DatePicker, Input, InputNumber, Select, Tag, Alert, Spin, Modal, List, Popconfirm, Switch } from 'antd';
import {
  BankOutlined, CheckCircleFilled, CloseCircleFilled, SearchOutlined, SettingOutlined,
  PlusOutlined, DeleteOutlined, EditOutlined,
} from '@ant-design/icons';
import api from '@/services/api';
import { listBanks } from '@/services/bankService';
import type { Bank } from '@/services/bankService';
import dayjs, { Dayjs } from 'dayjs';

interface BankConnection {
  id: number;
  provider: string;
  accountType: 'natural' | 'juridica';
  label: string;
  username: string | null;
  hasPassword: boolean;
  active: boolean;
}
interface BankProvider { key: string; name: string; accountType: 'natural' | 'juridica'; needsCredentials: boolean; }
interface VerificationResult {
  found: boolean;
  message?: string;
  movement?: {
    raw: string; description: string; reference: string | null; cedula: string | null;
    bankCode: string | null; amount: number | null; date: string | null; time: string | null;
  };
}

const BankVerification: React.FC = () => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [providers, setProviders] = useState<BankProvider[]>([]);
  const [connectionId, setConnectionId] = useState<number | undefined>();
  const [bankCode, setBankCode] = useState<string | undefined>();
  const [last4, setLast4] = useState('');
  const [cedula, setCedula] = useState('');
  const [date, setDate] = useState<Dayjs | null>(dayjs());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState('');

  const [cfgOpen, setCfgOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BankConnection | null>(null);
  const [formProvider, setFormProvider] = useState<string | undefined>();
  const [formLabel, setFormLabel] = useState('');
  const [formUser, setFormUser] = useState('');
  const [formPass, setFormPass] = useState('');
  const [cfgError, setCfgError] = useState('');

  const loadConnections = () => api.get<BankConnection[]>('/bank-verification/connections')
    .then(r => setConnections(r.data || [])).catch(() => {});

  useEffect(() => {
    listBanks({ active: true }).then(setBanks).catch(() => {});
    api.get<BankProvider[]>('/bank-verification/providers').then(r => setProviders(r.data || [])).catch(() => {});
    loadConnections();
  }, []);

  const activeConns = connections.filter(c => c.active);
  const canVerify = !!connectionId && /^\d{4}$/.test(last4) && cedula.trim().length >= 6;

  const verify = async () => {
    setLoading(true); setResult(null); setError('');
    try {
      const { data } = await api.post<VerificationResult>('/bank-verification/verify', {
        connectionId, bankCode, last4, cedula: cedula.trim(), date: date?.format('YYYY-MM-DD'),
      }, { timeout: 120000 });
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al verificar el pago');
    } finally { setLoading(false); }
  };

  const openEditor = (conn: BankConnection | null) => {
    setEditing(conn);
    setFormProvider(conn?.provider);
    setFormLabel(conn?.label ?? '');
    setFormUser(conn?.username ?? '');
    setFormPass('');
    setCfgError('');
    setFormOpen(true);
  };

  const closeEditor = () => {
    setEditing(null);
    setFormProvider(undefined);
    setCfgError('');
    setFormOpen(false);
  };

  const saveConnection = async () => {
    setCfgError('');
    try {
      const payload = { provider: formProvider, label: formLabel.trim(), username: formUser.trim(), password: formPass };
      if (editing) await api.put(`/bank-verification/connections/${editing.id}`, { label: payload.label, username: payload.username, password: formPass || undefined });
      else await api.post('/bank-verification/connections', payload);
      closeEditor();
      loadConnections();
    } catch (err: any) {
      setCfgError(err?.response?.data?.message || 'Error al guardar');
    }
  };

  const toggleActive = async (conn: BankConnection) => {
    await api.put(`/bank-verification/connections/${conn.id}`, { active: !conn.active }).catch(() => {});
    loadConnections();
  };

  const removeConnection = async (id: number) => {
    await api.delete(`/bank-verification/connections/${id}`).catch(() => {});
    loadConnections();
  };

  const selectedProvider = providers.find(p => p.key === formProvider);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Card
        title={<span className="flex items-center gap-2"><BankOutlined /> Verificación de pagos</span>}
        extra={
          <Button icon={<SettingOutlined />} onClick={() => setCfgOpen(true)}>
            Bancos y métodos de cobro
          </Button>
        }
      >
        <Alert type="info" showIcon className="mb-4"
          message="Consulta la cuenta receptora configurada y confirma si una transferencia fue recibida." />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Banco receptor (cuenta configurada)</label>
            <Select
              className="w-full" placeholder="Seleccione la conexión" value={connectionId} onChange={setConnectionId}
              options={activeConns.map(c => ({
                value: c.id,
                label: `${c.label} (${providers.find(p => p.key === c.provider)?.name ?? c.provider} — ${c.accountType === 'natural' ? 'Natural' : 'Jurídica'})`,
              }))}
              notFoundContent={activeConns.length === 0 ? 'Configure una conexión con la tuerca' : undefined}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Banco emisor</label>
            <Select
              className="w-full" placeholder="Cualquier banco" allowClear showSearch optionFilterProp="label"
              value={bankCode} onChange={v => setBankCode(v)}
              options={banks.map(b => ({ value: b.code, label: `${b.code} — ${b.shortName || b.name}` }))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Últimos 4 dígitos de la referencia</label>
            <Input maxLength={4} placeholder="1567" value={last4} onChange={e => setLast4(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Cédula del pagador</label>
            <InputNumber className="w-full" placeholder="18894410" controls={false}
              value={cedula ? Number(cedula) : null} onChange={v => setCedula(v == null ? '' : String(v))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha del pago</label>
            <DatePicker className="w-full" value={date} onChange={setDate} format="DD/MM/YYYY" allowClear />
          </div>
        </div>

        <Button type="primary" icon={<SearchOutlined />} className="mt-5" disabled={!canVerify || loading} onClick={verify}>
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

      <Modal
        title="Bancos y métodos de cobro"
        open={cfgOpen}
        onCancel={() => { setCfgOpen(false); closeEditor(); }}
        footer={<Button onClick={() => setCfgOpen(false)}>Cerrar</Button>}
        width={640}
      >
        <Alert type="info" showIcon className="mb-3"
          message="Cuentas naturales: verificación vía banca en línea. Cuentas jurídicas: usarán APIs de los bancos (próximamente)." />

        {!formOpen ? (
          <>
            <List
              dataSource={connections}
              locale={{ emptyText: 'No hay conexiones configuradas' }}
              renderItem={(c: BankConnection) => (
                <List.Item
                  actions={[
                    <Button key="e" size="small" icon={<EditOutlined />} onClick={() => openEditor(c)} />,
                    <Popconfirm key="d" title="¿Eliminar esta conexión?" onConfirm={() => removeConnection(c.id)}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>,
                    <Switch key="a" size="small" checked={c.active} onChange={() => toggleActive(c)} />,
                  ]}
                >
                  <List.Item.Meta
                    title={<span>{c.label} <Tag color={c.accountType === 'natural' ? 'blue' : 'purple'}>{c.accountType === 'natural' ? 'Natural' : 'Jurídica'}</Tag></span>}
                    description={`${providers.find(p => p.key === c.provider)?.name ?? c.provider} · Usuario: ${c.username ?? '—'} · Clave: ${c.hasPassword ? '••••••' : 'sin configurar'}`}
                  />
                </List.Item>
              )}
            />
            <Button type="dashed" block icon={<PlusOutlined />} className="mt-3" onClick={() => openEditor(null)}>
              Agregar banco
            </Button>
          </>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Banco</label>
            <Select
              className="w-full mb-3" placeholder="Seleccione el banco"
              value={formProvider} onChange={setFormProvider} disabled={!!editing}
              options={providers.map(p => ({ value: p.key, label: `${p.name} — ${p.accountType === 'natural' ? 'Natural' : 'Jurídica'}` }))}
            />
            <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre de la conexión</label>
            <Input className="mb-3" placeholder="Ej. Cuenta corriente principal" value={formLabel} onChange={e => setFormLabel(e.target.value)} />
            {selectedProvider?.needsCredentials !== false && (
              <>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Usuario de banca en línea</label>
                <Input className="mb-3" value={formUser} onChange={e => setFormUser(e.target.value)} />
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Contraseña {editing && <span className="font-normal">(dejar vacía para conservar la actual)</span>}
                </label>
                <Input.Password className="mb-3" value={formPass} onChange={e => setFormPass(e.target.value)} />
              </>
            )}
            {cfgError && <Alert type="error" showIcon className="mb-3" message={cfgError} />}
            <div className="flex gap-2">
              <Button onClick={closeEditor}>Volver</Button>
              <Button type="primary" onClick={saveConnection}
                disabled={!formLabel.trim() || (!editing && !formProvider) || (!editing && (!formUser.trim() || !formPass))}>
                Guardar conexión
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BankVerification;
