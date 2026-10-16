import React, { useCallback, useEffect, useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Switch, Upload, message } from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { listBanks, createBank, updateBank, type Bank } from '@/services/bankService';

const BanksCard: React.FC = () => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Bank | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBanks(await listBanks());
    } catch {
      message.error('Error al cargar los bancos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openModal = (bank?: Bank) => {
    setEditing(bank ?? null);
    setIconFile(null);
    form.resetFields();
    if (bank) form.setFieldsValue({ code: bank.code, name: bank.name, shortName: bank.shortName, rif: bank.rif });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await updateBank(editing.id, values, iconFile);
        message.success('Banco actualizado');
      } else {
        await createBank(values, iconFile);
        message.success('Banco creado');
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      if (err?.response) message.error(err.response.data?.message || 'Error al guardar el banco');
    }
  };

  const handleToggle = async (bank: Bank, active: boolean) => {
    try {
      await updateBank(bank.id, { active });
      load();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error al actualizar el banco');
    }
  };

  return (
    <Card
      title="Bancos"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Nuevo banco</Button>}
    >
      <p style={{ marginBottom: 12, color: '#6B7280' }}>
        Catálogo de bancos venezolanos con código Sudeban. Se usa al registrar pagos en bolívares
        (transferencia / pago móvil). Desactivar un banco lo oculta del selector sin borrar los
        pagos ya registrados con él.
      </p>
      <Table
        size="small"
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 15 }}
        dataSource={banks}
        columns={[
          {
            title: '', dataIndex: 'icon', key: 'icon', width: 56,
            render: (icon: string | null) =>
              icon ? <img src={icon} alt="" style={{ height: 24, objectFit: 'contain' }} /> : '—',
          },
          { title: 'Código', dataIndex: 'code', key: 'code', width: 80 },
          { title: 'Nombre', dataIndex: 'shortName', key: 'shortName' },
          { title: 'Nombre oficial', dataIndex: 'name', key: 'name' },
          { title: 'RIF', dataIndex: 'rif', key: 'rif', render: (v: string | null) => v ?? '—' },
          {
            title: 'Activo', dataIndex: 'active', key: 'active', width: 80,
            render: (active: boolean, r: Bank) => <Switch checked={active} onChange={(v) => handleToggle(r, v)} />,
          },
          {
            title: '', key: 'actions', width: 60,
            render: (_: unknown, r: Bank) => <Button size="small" onClick={() => openModal(r)}>Editar</Button>,
          },
        ]}
      />
      <Modal
        title={editing ? 'Editar banco' : 'Nuevo banco'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Guardar"
        cancelText="Cancelar"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code" label="Código (4 dígitos)"
            rules={[{ required: true, pattern: /^\d{4}$/, message: 'Código de 4 dígitos' }]}
          >
            <Input placeholder="0134" maxLength={4} />
          </Form.Item>
          <Form.Item name="shortName" label="Nombre corto" rules={[{ required: true, message: 'Indique el nombre corto' }]}>
            <Input placeholder="Banesco" />
          </Form.Item>
          <Form.Item name="name" label="Nombre oficial" rules={[{ required: true, message: 'Indique el nombre oficial' }]}>
            <Input placeholder="Banesco, Banco Universal S.A.C.A." />
          </Form.Item>
          <Form.Item name="rif" label="RIF (opcional)">
            <Input placeholder="J070133805" />
          </Form.Item>
          <Form.Item label={editing ? 'Ícono (opcional — reemplaza el actual)' : 'Ícono (opcional)'}>
            <Upload
              accept="image/*"
              maxCount={1}
              beforeUpload={(file) => { setIconFile(file); return false; }}
              onRemove={() => setIconFile(null)}
            >
              <Button icon={<UploadOutlined />}>Seleccionar imagen</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default BanksCard;
