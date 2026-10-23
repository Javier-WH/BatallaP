import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Switch, DatePicker, Popconfirm, Space, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSchool } from '@/context/SchoolContext';
import {
  listCurrencyDiscounts, createCurrencyDiscount, updateCurrencyDiscount, deleteCurrencyDiscount,
  type CurrencyDiscount,
} from '@/services/paymentsService';

const CURRENCIES = ['USD', 'EUR', 'VES', 'USDT'];

const describeRule = (d: Pick<CurrencyDiscount, 'kind' | 'value'>) =>
  d.kind === 'percent' ? `${d.value}% menos` : `${d.value.toFixed(2)} menos por deuda saldada`;

const fmtDay = (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : null);

/**
 * Discounts for paying in a given currency (e.g. 20% for USDT). They belong to a
 * school period and apply to every payment made in that currency inside the
 * validity window; they are not assigned per student.
 */
const CurrencyDiscountsCard: React.FC = () => {
  const { allPeriods, activePeriod } = useSchool();
  const periods = useMemo(() => allPeriods.filter((p: any) => p.status !== 'externo'), [allPeriods]);
  const [periodId, setPeriodId] = useState<number | undefined>(activePeriod?.id);
  const [rows, setRows] = useState<CurrencyDiscount[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<CurrencyDiscount | 'new' | null>(null);
  const [form] = Form.useForm();
  const kind = Form.useWatch('kind', form);

  useEffect(() => { if (!periodId && activePeriod?.id) setPeriodId(activePeriod.id); }, [activePeriod, periodId]);

  const load = useCallback(async () => {
    if (!periodId) return;
    setLoading(true);
    try {
      setRows(await listCurrencyDiscounts(periodId));
    } catch {
      message.error('Error al cargar los descuentos por divisa');
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  useEffect(() => { load(); }, [load]);

  const openModal = (row: CurrencyDiscount | 'new') => {
    setEditing(row);
    if (row === 'new') {
      form.resetFields();
      form.setFieldsValue({ currency: 'USDT', kind: 'percent', active: true });
    } else {
      form.setFieldsValue({
        ...row,
        validFrom: row.validFrom ? dayjs(row.validFrom) : null,
        validTo: row.validTo ? dayjs(row.validTo) : null,
      });
    }
  };

  const save = async () => {
    try {
      const v = await form.validateFields();
      const payload = {
        name: v.name, currency: v.currency, kind: v.kind, value: v.value, active: v.active,
        note: v.note || null,
        validFrom: v.validFrom ? v.validFrom.format('YYYY-MM-DD') : null,
        validTo: v.validTo ? v.validTo.format('YYYY-MM-DD') : null,
      };
      if (editing === 'new') await createCurrencyDiscount({ ...payload, schoolPeriodId: periodId });
      else if (editing) await updateCurrencyDiscount(editing.id, payload);
      message.success('Descuento guardado');
      setEditing(null);
      load();
    } catch (err: any) {
      if (err?.response) message.error(err.response.data?.message || 'Error al guardar el descuento');
    }
  };

  const toggle = async (row: CurrencyDiscount, active: boolean) => {
    try {
      await updateCurrencyDiscount(row.id, { active });
      load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error al actualizar el descuento');
    }
  };

  const remove = async (row: CurrencyDiscount) => {
    try {
      await deleteCurrencyDiscount(row.id);
      load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error al eliminar el descuento');
    }
  };

  return (
    <Card
      title="Descuentos por pagar en divisa"
      extra={
        <Space>
          <Select
            style={{ width: 200 }}
            value={periodId}
            onChange={setPeriodId}
            options={periods.map((p: any) => ({ value: p.id, label: p.period }))}
          />
          <Button type="primary" icon={<PlusOutlined />} disabled={!periodId} onClick={() => openModal('new')}>Nuevo descuento</Button>
        </Space>
      }
    >
      <p style={{ marginBottom: 12, color: '#6B7280' }}>
        Se aplican solos a todos los pagos del período hechos en la moneda indicada, dentro de su vigencia (no se asignan
        a cada estudiante). <b>Porcentaje:</b> el pago saldará más deuda, p. ej. 20% con USDT → 80 USDT saldan 100 USD.
        <b> Monto fijo:</b> se descuenta de cada deuda (mensualidad, inscripción, item…) que el pago salde completa, en la
        moneda de esa deuda. Se suman al descuento personal del estudiante. Solo puede haber una regla activa por moneda y fecha.
      </p>
      <Table
        size="small"
        rowKey="id"
        loading={loading}
        pagination={false}
        dataSource={rows}
        locale={{ emptyText: 'No hay descuentos por divisa en este período' }}
        columns={[
          { title: 'Nombre', dataIndex: 'name', key: 'name' },
          { title: 'Paga en', dataIndex: 'currency', key: 'currency', render: (c: string) => <Tag>{c}</Tag> },
          { title: 'Descuento', key: 'value', render: (_: unknown, r: CurrencyDiscount) => describeRule(r) },
          {
            title: 'Vigencia', key: 'valid',
            render: (_: unknown, r: CurrencyDiscount) =>
              !r.validFrom && !r.validTo ? 'Todo el período'
                : `${fmtDay(r.validFrom) ?? 'desde el inicio'} → ${fmtDay(r.validTo) ?? 'sin fin'}`,
          },
          {
            title: 'Activo', dataIndex: 'active', key: 'active',
            render: (active: boolean, r: CurrencyDiscount) => <Switch checked={active} onChange={v => toggle(r, v)} />,
          },
          {
            title: '', key: 'actions', width: 90,
            render: (_: unknown, r: CurrencyDiscount) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
                <Popconfirm title="¿Eliminar este descuento?" okText="Eliminar" cancelText="Cancelar" onConfirm={() => remove(r)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing === 'new' ? 'Nuevo descuento por divisa' : 'Editar descuento por divisa'}
        open={!!editing}
        onOk={save}
        onCancel={() => setEditing(null)}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Nombre" rules={[{ required: true, message: 'Indique el nombre' }]}>
            <Input placeholder="Pago en USDT" />
          </Form.Item>
          <Space size="middle" align="start" wrap>
            <Form.Item name="currency" label="Si el pago se hace en" rules={[{ required: true }]}>
              <Select style={{ width: 130 }} options={CURRENCIES.map(c => ({ value: c, label: c }))} />
            </Form.Item>
            <Form.Item name="kind" label="Tipo" rules={[{ required: true }]}>
              <Select style={{ width: 190 }} options={[
                { value: 'percent', label: 'Porcentaje' },
                { value: 'fixed', label: 'Monto fijo por deuda saldada' },
              ]} />
            </Form.Item>
            <Form.Item
              name="value"
              label={kind === 'fixed' ? 'Monto (moneda de la deuda)' : 'Porcentaje'}
              rules={[
                { required: true, message: 'Indique el valor' },
                { type: 'number', min: 0.01, message: 'Debe ser mayor que cero' },
                ...(kind === 'percent' ? [{ type: 'number' as const, max: 99.99, message: 'Debe ser menor que 100' }] : []),
              ]}
            >
              <InputNumber style={{ width: 130 }} min={0} step={kind === 'fixed' ? 1 : 5} addonAfter={kind === 'fixed' ? undefined : '%'} />
            </Form.Item>
          </Space>
          <Space size="middle" wrap>
            <Form.Item name="validFrom" label="Vigente desde (opcional)">
              <DatePicker format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="validTo" label="Vigente hasta (opcional)">
              <DatePicker format="DD/MM/YYYY" />
            </Form.Item>
          </Space>
          <Form.Item name="active" label="Activo" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="note" label="Nota (opcional)">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default CurrencyDiscountsCard;
