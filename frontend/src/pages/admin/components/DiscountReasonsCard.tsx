import React, { useCallback, useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Switch, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
  listDiscountReasons, createDiscountReason, updateDiscountReason, type DiscountReason,
} from '@/services/paymentsService';

const DiscountReasonsCard: React.FC = () => {
  const [reasons, setReasons] = useState<DiscountReason[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReasons(await listDiscountReasons());
    } catch {
      message.error('Error al cargar los motivos de descuento');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await createDiscountReason(values);
      message.success('Motivo creado');
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (err: any) {
      if (err?.response) message.error(err.response.data?.message || 'Error al crear el motivo');
    }
  };

  const handleToggle = async (reason: DiscountReason, active: boolean) => {
    try {
      await updateDiscountReason(reason.id, { active });
      load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error al actualizar el motivo');
    }
  };

  return (
    <Card
      title="Motivos de descuentos y becas"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>Nuevo motivo</Button>}
    >
      <p style={{ marginBottom: 12, color: '#6B7280' }}>
        Catálogo de razones para aplicar descuentos o becas a un estudiante (clic derecho sobre el estudiante en el Ledger →
        Descuentos y becas). Desactivar un motivo no afecta los descuentos ya aplicados.
      </p>
      <Table
        size="small"
        rowKey="id"
        loading={loading}
        pagination={false}
        dataSource={reasons}
        columns={[
          { title: 'Motivo', dataIndex: 'name', key: 'name' },
          { title: 'Descripción', dataIndex: 'description', key: 'description', render: (v: string | null) => v ?? '—' },
          {
            title: 'Activo', dataIndex: 'active', key: 'active',
            render: (active: boolean, r: DiscountReason) => <Switch checked={active} onChange={(v) => handleToggle(r, v)} />,
          },
        ]}
      />
      <Modal
        title="Nuevo motivo de descuento"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => setModalOpen(false)}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Nombre" rules={[{ required: true, message: 'Indique el nombre' }]}>
            <Input placeholder="Beca musical" />
          </Form.Item>
          <Form.Item name="description" label="Descripción (opcional)">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default DiscountReasonsCard;
