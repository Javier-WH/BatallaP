import React, { useState } from 'react';
import { Card, Table, Select, Button, Tag, message } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useSchool } from '@/context/SchoolContext';
import { updateBillingCalendar } from '@/services/paymentsService';

const MONTH_OPTIONS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
].map((label, i) => ({ value: i + 1, label }));

const monthName = (n: number) => MONTH_OPTIONS[n - 1]?.label ?? '—';

const monthCount = (start: number, end: number) => ((end - start + 12) % 12) + 1;

const BillingCalendarCard: React.FC = () => {
  const { allPeriods, refreshSettings } = useSchool();
  const [draft, setDraft] = useState<Record<number, { start?: number; end?: number }>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const periods = allPeriods.filter((p: any) => p.status !== 'externo');

  const valuesOf = (p: any) => ({
    start: draft[p.id]?.start ?? p.billingStartMonth ?? 9,
    end: draft[p.id]?.end ?? p.billingEndMonth ?? 8,
  });

  const save = async (p: any) => {
    const { start, end } = valuesOf(p);
    setSaving(p.id);
    try {
      await updateBillingCalendar(p.id, { billingStartMonth: start, billingEndMonth: end });
      message.success(`Calendario de cobro de ${p.period} actualizado`);
      setDraft(d => {
        const { [p.id]: _omit, ...rest } = d;
        return rest;
      });
      await refreshSettings();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error al guardar el calendario de cobro');
    } finally {
      setSaving(null);
    }
  };

  const columns = [
    {
      title: 'Período',
      key: 'period',
      render: (_: any, p: any) => (
        <span>{p.period} {p.status === 'activo' && <Tag color="green">Activo</Tag>}</span>
      ),
    },
    {
      title: 'Primer mes de cobro',
      key: 'start',
      render: (_: any, p: any) => (
        <Select
          style={{ width: 160 }}
          value={valuesOf(p).start}
          options={MONTH_OPTIONS}
          onChange={(v) => setDraft(d => ({ ...d, [p.id]: { ...d[p.id], start: v } }))}
        />
      ),
    },
    {
      title: 'Último mes de cobro',
      key: 'end',
      render: (_: any, p: any) => (
        <Select
          style={{ width: 160 }}
          value={valuesOf(p).end}
          options={MONTH_OPTIONS}
          onChange={(v) => setDraft(d => ({ ...d, [p.id]: { ...d[p.id], end: v } }))}
        />
      ),
    },
    {
      title: 'Meses',
      key: 'count',
      render: (_: any, p: any) => {
        const { start, end } = valuesOf(p);
        return `${monthCount(start, end)} (${monthName(start)} → ${monthName(end)})`;
      },
    },
    {
      title: '',
      key: 'actions',
      render: (_: any, p: any) => {
        const { start, end } = valuesOf(p);
        const dirty = start !== (p.billingStartMonth ?? 9) || end !== (p.billingEndMonth ?? 8);
        return (
          <Button
            type="primary"
            size="small"
            icon={<SaveOutlined />}
            disabled={!dirty}
            loading={saving === p.id}
            onClick={() => save(p)}
          >
            Guardar
          </Button>
        );
      },
    },
  ];

  return (
    <Card title="Meses que se cobran en cada período escolar">
      <p style={{ marginBottom: 12, color: '#6B7280' }}>
        Define desde qué mes y hasta cuál se cobra la mensualidad. Con esto el sistema calcula
        cuántas mensualidades debe un estudiante según su mes de ingreso (el mes de ingreso queda
        cubierto por la inscripción).
      </p>
      <Table columns={columns} dataSource={periods} rowKey="id" pagination={false} size="small" />
    </Card>
  );
};

export default BillingCalendarCard;
