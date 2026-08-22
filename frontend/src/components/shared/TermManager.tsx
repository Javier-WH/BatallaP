import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Typography, Space, message, Spin, DatePicker, Table, Modal, Popconfirm, Tooltip, Tag, Form, Input, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '@/services/api';

const { Text, Title } = Typography;

interface Term {
  id: number;
  name: string;
  isBlocked: boolean;
  isActive: boolean;
  openDate?: string;
  closeDate?: string;
  schoolPeriodId: number;
  order: number;
}

const TermManager: React.FC = () => {
  const [termForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [terms, setTerms] = useState<Term[]>([]);
  const [activePeriod, setActivePeriod] = useState<{ id: number; name: string } | null>(null);
  const [showTermModal, setShowTermModal] = useState(false);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [termSubmitting, setTermSubmitting] = useState(false);

  const fetchTerms = useCallback(async () => {
    setLoading(true);
    try {
      const periodRes = await api.get('/academic/active');
      setActivePeriod(periodRes.data);
      if (periodRes.data) {
        const termsRes = await api.get(`/terms?schoolPeriodId=${periodRes.data.id}`);
        setTerms(termsRes.data.sort((a: any, b: any) => a.order - b.order));
      }
    } catch {
      message.error('Error al cargar los lapsos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTerms(); }, [fetchTerms]);

  const handleAddTerm = () => {
    setEditingTerm(null);
    termForm.resetFields();
    termForm.setFieldsValue({ isBlocked: false });
    setShowTermModal(true);
  };

  const handleEditTerm = (term: Term) => {
    setEditingTerm(term);
    termForm.setFieldsValue({
      name: term.name,
      isBlocked: term.isBlocked,
      openDate: term.openDate ? dayjs(term.openDate) : undefined,
      closeDate: term.closeDate ? dayjs(term.closeDate) : undefined,
    });
    setShowTermModal(true);
  };

  const handleDeleteTerm = async (termId: number) => {
    try {
      await api.delete(`/terms/${termId}`);
      message.success('Lapso eliminado');
      fetchTerms();
    } catch {
      message.error('Error al eliminar el lapso');
    }
  };

  const handleSaveTerm = async (values: any) => {
    if (!activePeriod) { message.error('No hay un período escolar activo'); return; }
    setTermSubmitting(true);
    try {
      const payload = {
        name: values.name, isBlocked: values.isBlocked,
        openDate: values.openDate ? values.openDate.toISOString() : null,
        closeDate: values.closeDate ? values.closeDate.toISOString() : null,
        schoolPeriodId: activePeriod.id
      };
      if (editingTerm) {
        await api.put(`/terms/${editingTerm.id}`, payload);
        message.success('Lapso actualizado');
      } else {
        await api.post('/terms', payload);
        message.success('Lapso creado');
      }
      setShowTermModal(false);
      fetchTerms();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Error al guardar');
    } finally {
      setTermSubmitting(false);
    }
  };

  const toggleTermBlock = async (term: Term) => {
    try {
      await api.put(`/terms/${term.id}`, { isBlocked: !term.isBlocked });
      message.success(`Lapso ${!term.isBlocked ? 'bloqueado' : 'desbloqueado'}`);
      fetchTerms();
    } catch {
      message.error('Error al cambiar estado');
    }
  };

  const termColumns = [
    { title: 'Orden', dataIndex: 'order', width: 80, align: 'center' as const,
      render: (val: number) => <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: '#f0f2f5', color: '#595959', fontWeight: 800, fontSize: 14 }}>{val}º</div>
    },
    { title: 'Nombre', dataIndex: 'name', key: 'name' },
    { title: 'Estado', dataIndex: 'isBlocked', key: 'isBlocked', align: 'center' as const, width: 100,
      render: (val: boolean) => val ? <Tag color="error" icon={<LockOutlined />}>Cerrado</Tag> : <Tag color="success" icon={<UnlockOutlined />}>Abierto</Tag>
    },
    { title: 'Inicio', dataIndex: 'openDate', key: 'openDate', width: 110,
      render: (d: string) => d ? dayjs(d).format('DD/MM/YYYY') : <Text type="secondary">—</Text>
    },
    { title: 'Cierre', dataIndex: 'closeDate', key: 'closeDate', width: 110,
      render: (d: string) => d ? dayjs(d).format('DD/MM/YYYY') : <Text type="secondary">—</Text>
    },
    { title: 'Acciones', key: 'actions', width: 130, align: 'center' as const,
      render: (_: unknown, record: Term) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditTerm(record)} />
          <Tooltip title={record.isBlocked ? 'Desbloquear' : 'Bloquear'}>
            <Popconfirm title={`¿${record.isBlocked ? 'Desbloquear' : 'Bloquear'}?`} onConfirm={() => toggleTermBlock(record)}>
              <Button type="link" icon={record.isBlocked ? <LockOutlined /> : <UnlockOutlined />} danger={record.isBlocked} />
            </Popconfirm>
          </Tooltip>
          <Popconfirm title="¿Eliminar lapso?" onConfirm={() => handleDeleteTerm(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    },
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;

  return (
    <>
      <Card
        styles={{ body: { padding: 0 } }}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
            <Space direction="vertical" size={2}>
              <Text style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1 }}>Cronograma Académico</Text>
              <Title level={4} style={{ margin: 0, fontWeight: 800 }}>Gestión de Lapsos</Title>
            </Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddTerm} disabled={!activePeriod}
              style={{ borderRadius: 12, fontWeight: 700, height: 40, padding: '0 20px' }}>
              Nuevo Lapso
            </Button>
          </div>
        }
      >
        {!activePeriod ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Active un período escolar para gestionar sus lapsos." />
          </div>
        ) : (
          <Table columns={termColumns} dataSource={terms} rowKey="id" pagination={false} bordered size="small" />
        )}
      </Card>

      <Modal open={showTermModal} onCancel={() => setShowTermModal(false)} footer={null} destroyOnClose centered width={480}
        title={<Title level={4}>{editingTerm ? 'Editar Lapso' : 'Nuevo Lapso'}</Title>}>
        <Form form={termForm} layout="vertical" onFinish={handleSaveTerm}>
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
            <Input placeholder="Ej: Primer Lapso" />
          </Form.Item>
          <Space style={{ width: '100%' }} size="middle">
            <Form.Item name="openDate" label="Fecha de Inicio">
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="closeDate" label="Fecha de Cierre">
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Button type="primary" htmlType="submit" loading={termSubmitting} block size="large" style={{ marginTop: 16, borderRadius: 12 }}>
            {editingTerm ? 'Actualizar' : 'Crear'} Lapso
          </Button>
        </Form>
      </Modal>
    </>
  );
};

export default TermManager;