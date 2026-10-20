import React, { useEffect, useState } from 'react';
import { Modal, Table, Button, Form, Select, InputNumber, Input, Popconfirm, Tag, Divider, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  listDiscountReasons, createInscriptionDiscount, deleteInscriptionDiscount,
  type DiscountReason, type LedgerDiscount, type LedgerStudent,
} from '@/services/paymentsService';
import { MONTH_NAMES } from '@/utils/billingMonths';

const SCOPE_LABEL: Record<string, string> = {
  todo: 'Mensualidad, inscripción y gastos',
  mensualidad: 'Solo mensualidades',
  matricula: 'Solo inscripción (matrícula, gastos y mensualidad incluida)',
};

const describeValue = (d: LedgerDiscount) =>
  d.kind === 'percent' ? `${d.value}%` : `${d.value.toLocaleString('es-VE', { minimumFractionDigits: 2 })} por cobro`;

const describeRange = (d: LedgerDiscount) => {
  if (!d.fromMonth && !d.toMonth) return 'Todo el período';
  return `${d.fromMonth ? `Desde ${MONTH_NAMES[d.fromMonth]}` : 'Desde el inicio'}${d.toMonth ? ` hasta ${MONTH_NAMES[d.toMonth]}` : ''}`;
};

interface Props {
  student: LedgerStudent | null;
  months: string[];
  onClose: () => void;
  onChanged: () => void;
}

const DiscountsModal: React.FC<Props> = ({ student, months, onClose, onChanged }) => {
  const [reasons, setReasons] = useState<DiscountReason[]>([]);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const kind = Form.useWatch('kind', form);

  useEffect(() => {
    if (!student) return;
    form.resetFields();
    form.setFieldsValue({ kind: 'percent', appliesTo: 'todo' });
    listDiscountReasons()
      .then(r => setReasons(r.filter(x => x.active)))
      .catch(() => message.error('Error al cargar los motivos de descuento'));
  }, [student?.inscriptionId]);

  if (!student) return null;

  const monthOptions = months.map(m => ({ value: m, label: MONTH_NAMES[m] }));

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await createInscriptionDiscount(student.inscriptionId, values);
      message.success('Descuento aplicado');
      form.resetFields();
      form.setFieldsValue({ kind: 'percent', appliesTo: 'todo' });
      onChanged();
    } catch (err: any) {
      if (err?.response) message.error(err.response.data?.message || 'Error al aplicar el descuento');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteInscriptionDiscount(id);
      message.success('Descuento eliminado');
      onChanged();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error al eliminar el descuento');
    }
  };

  return (
    <Modal
      open
      title={`Descuentos y becas — ${student.name}`}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Cerrar</Button>}
      width={720}
    >
      <Table
        size="small"
        pagination={false}
        rowKey="id"
        dataSource={student.discounts}
        locale={{ emptyText: 'Este estudiante no tiene descuentos ni becas.' }}
        columns={[
          { title: 'Motivo', dataIndex: 'reasonName', key: 'reason', render: (v: string, d: LedgerDiscount) => <span>{v}{d.note ? <small style={{ display: 'block', color: '#6B7280' }}>{d.note}</small> : null}</span> },
          { title: 'Descuento', key: 'value', render: (_: any, d: LedgerDiscount) => <Tag color="green">{describeValue(d)}</Tag> },
          { title: 'Aplica a', key: 'scope', render: (_: any, d: LedgerDiscount) => SCOPE_LABEL[d.appliesTo] },
          { title: 'Vigencia', key: 'range', render: (_: any, d: LedgerDiscount) => describeRange(d) },
          {
            title: '', key: 'actions',
            render: (_: any, d: LedgerDiscount) => (
              <Popconfirm title="¿Eliminar este descuento?" okText="Eliminar" cancelText="Cancelar" onConfirm={() => handleDelete(d.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            ),
          },
        ]}
      />

      <Divider>Aplicar nuevo descuento o beca</Divider>

      <Form form={form} layout="vertical">
        <Form.Item name="reasonId" label="Motivo" rules={[{ required: true, message: 'Seleccione el motivo' }]}>
          <Select
            placeholder="Hermanos, beca deportiva, hijo de personal…"
            options={reasons.map(r => ({ value: r.id, label: r.name }))}
            notFoundContent="No hay motivos activos. Créelos en Configuración de Pagos."
          />
        </Form.Item>
        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item name="kind" label="Tipo" style={{ flex: 1 }} rules={[{ required: true }]}>
            <Select options={[{ value: 'percent', label: 'Porcentaje (%)' }, { value: 'fixed', label: 'Monto fijo por cobro' }]} />
          </Form.Item>
          <Form.Item name="value" label={kind === 'fixed' ? 'Monto' : 'Porcentaje'} style={{ flex: 1 }} rules={[{ required: true, message: 'Indique el valor' }]}>
            <InputNumber min={0.01} max={kind === 'fixed' ? undefined : 100} step={kind === 'fixed' ? 1 : 5} style={{ width: '100%' }} addonAfter={kind === 'fixed' ? undefined : '%'} />
          </Form.Item>
        </div>
        <Form.Item name="appliesTo" label="Aplica a" rules={[{ required: true }]}>
          <Select options={Object.entries(SCOPE_LABEL).map(([value, label]) => ({ value, label }))} />
        </Form.Item>
        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item name="fromMonth" label="Desde el mes" style={{ flex: 1 }} tooltip="Vacío = desde el inicio del período. La inscripción solo se descuenta si el descuento rige desde el inicio.">
            <Select allowClear placeholder="Desde el inicio" options={monthOptions} />
          </Form.Item>
          <Form.Item name="toMonth" label="Hasta el mes" style={{ flex: 1 }} tooltip="Vacío = hasta el final del período.">
            <Select allowClear placeholder="Hasta el final" options={monthOptions} />
          </Form.Item>
        </div>
        <Form.Item name="note" label="Nota (opcional)">
          <Input.TextArea rows={2} placeholder="Ej.: Tercer hermano inscrito" />
        </Form.Item>
        <Button type="primary" icon={<PlusOutlined />} loading={saving} onClick={handleAdd}>
          Aplicar descuento
        </Button>
      </Form>
    </Modal>
  );
};

export default DiscountsModal;
