import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Table, Button, Select, InputNumber, Input, Statistic, Tag, message, Alert } from 'antd';
import dayjs from 'dayjs';
import {
  getItemInventory, createInventoryMovement,
  type SellableItem, type ItemInventoryDetail, type InventorySizeRow, type InventoryMovement,
} from '@/services/paymentsService';

interface Props {
  item: SellableItem | null;
  periods: { id: number; period: string }[];
  onClose: () => void;
}

const sizeLabel = (s: string | null) => s ?? 'Sin talla';

/**
 * Stock by size of one sellable item: on-hand stock, units sold/delivered,
 * a form to record audited ingresos/ajustes and the movement history.
 */
const ItemInventoryModal: React.FC<Props> = ({ item, periods, onClose }) => {
  const [periodId, setPeriodId] = useState<number | undefined>(undefined);
  const [data, setData] = useState<ItemInventoryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<'ingreso' | 'ajuste'>('ingreso');
  const [size, setSize] = useState<string | undefined>(undefined);
  const [quantity, setQuantity] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!item) return;
    setLoading(true);
    try {
      setData(await getItemInventory(item.id, periodId));
    } catch {
      message.error('No se pudo cargar el inventario');
    } finally {
      setLoading(false);
    }
  }, [item, periodId]);

  useEffect(() => { if (item) load(); }, [item, load]);
  useEffect(() => { if (item) { setType('ingreso'); setSize(undefined); setQuantity(null); setNote(''); setData(null); } }, [item]);

  const hasSizes = (item?.sizes?.length ?? 0) > 0;

  const submit = async () => {
    if (!item || !quantity) { message.warning('Indica la cantidad'); return; }
    if (hasSizes && !size) { message.warning('Elige la talla'); return; }
    setSaving(true);
    try {
      await createInventoryMovement(item.id, { type, size: size ?? null, quantity, note: note.trim() || undefined });
      message.success(type === 'ingreso' ? 'Ingreso registrado' : 'Ajuste registrado');
      setQuantity(null); setNote('');
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? 'Error al registrar el movimiento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!item}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Cerrar</Button>}
      width={860}
      title={item ? `Inventario — ${item.name}` : 'Inventario'}
      destroyOnClose
    >
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-xs text-slate-500">Ventas y entregas del período:</span>
        <Select
          size="small" style={{ width: 160 }} allowClear placeholder="Todos"
          value={periodId} onChange={setPeriodId}
          options={periods.map(p => ({ value: p.id, label: p.period }))}
        />
        <span className="text-[11px] text-slate-400">El stock siempre es el total acumulado.</span>
      </div>

      {data && (
        <>
          <div className="flex gap-8 mb-3">
            <Statistic title="Vendidas" value={data.sold} />
            <Statistic title="Entregadas" value={data.delivered} />
            <Statistic title="Sin entregar (talla por definir)" value={data.pendingDelivery} />
          </div>
          {!data.configured && (
            <Alert
              type="info" showIcon className="mb-3"
              message="Este item aún no tiene inventario configurado"
              description="Las entregas igual se cuentan por talla. Registra un ingreso para empezar a llevar el stock."
            />
          )}
          <Table<InventorySizeRow>
            size="small" rowKey={r => r.size ?? '__none'} loading={loading} pagination={false}
            dataSource={data.rows}
            columns={[
              {
                title: 'Talla', key: 'size',
                render: (_: unknown, r) => <span>{sizeLabel(r.size)}{r.retired && <Tag className="ml-2">retirada</Tag>}</span>,
              },
              { title: 'Ingresado', dataIndex: 'received', align: 'right' as const },
              { title: 'Entregadas', dataIndex: 'delivered', align: 'right' as const },
              {
                title: 'Stock', dataIndex: 'stock', align: 'right' as const,
                render: (v: number | null) => v == null ? '—' : <b className={v < 0 ? 'text-red-600' : v === 0 ? 'text-amber-600' : 'text-green-700'}>{v}</b>,
              },
            ]}
          />
        </>
      )}

      <div className="mt-4 p-3 bg-slate-50 rounded flex flex-wrap items-end gap-2">
        <div>
          <div className="text-[11px] text-slate-500">Movimiento</div>
          <Select<'ingreso' | 'ajuste'> style={{ width: 120 }} value={type} onChange={setType}
            options={[{ value: 'ingreso', label: 'Ingreso' }, { value: 'ajuste', label: 'Ajuste' }]} />
        </div>
        {hasSizes && (
          <div>
            <div className="text-[11px] text-slate-500">Talla</div>
            <Select style={{ width: 110 }} value={size} onChange={setSize} placeholder="Talla"
              options={item!.sizes!.map(s => ({ value: s, label: s }))} />
          </div>
        )}
        <div>
          <div className="text-[11px] text-slate-500">{type === 'ingreso' ? 'Cantidad' : 'Cantidad (+/−)'}</div>
          <InputNumber style={{ width: 100 }} precision={0} min={type === 'ingreso' ? 1 : undefined} value={quantity} onChange={setQuantity} />
        </div>
        <div className="flex-1 min-w-[160px]">
          <div className="text-[11px] text-slate-500">{type === 'ajuste' ? 'Motivo (obligatorio)' : 'Nota (opcional)'}</div>
          <Input value={note} onChange={e => setNote(e.target.value)} maxLength={500} />
        </div>
        <Button type="primary" loading={saving} onClick={submit}>Registrar</Button>
      </div>

      <div className="mt-4 text-xs font-semibold text-slate-600">Historial de movimientos</div>
      <Table<InventoryMovement>
        size="small" rowKey="id" className="mt-1"
        dataSource={data?.movements ?? []}
        pagination={(data?.movements.length ?? 0) > 8 ? { pageSize: 8, size: 'small' } : false}
        locale={{ emptyText: 'Sin movimientos registrados' }}
        columns={[
          { title: 'Fecha', dataIndex: 'createdAt', width: 130, render: (d: string) => dayjs(d).format('DD/MM/YYYY HH:mm') },
          { title: 'Tipo', dataIndex: 'type', width: 90, render: (t: string) => <Tag color={t === 'ingreso' ? 'green' : 'orange'}>{t === 'ingreso' ? 'Ingreso' : 'Ajuste'}</Tag> },
          { title: 'Talla', dataIndex: 'size', width: 80, render: (s: string | null) => sizeLabel(s) },
          { title: 'Cantidad', dataIndex: 'quantity', width: 90, align: 'right' as const, render: (q: number) => (q > 0 ? `+${q}` : q) },
          { title: 'Registró', key: 'by', render: (_: unknown, m) => (m.createdBy ? `${m.createdBy.firstName} ${m.createdBy.lastName}` : '—') },
          { title: 'Nota', dataIndex: 'note', render: (n: string | null) => n || '—' },
        ]}
      />
    </Modal>
  );
};

export default ItemInventoryModal;
