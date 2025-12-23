import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Card,
  Button,
  Input,
  Select,
  Space,
  Tag,
  message,
  Modal,
  Form,
  Popconfirm,
  Typography
} from 'antd';
import {
  BankOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined
} from '@ant-design/icons';
import api from '@/services/api';

const { Search } = Input;
const { Option } = Select;
const { Text } = Typography;

interface Plantel {
  id: number;
  code: string;
  name: string;
  state: string;
  dependency: string;
  municipality?: string;
  parish?: string;
}

interface PlantelFormValues {
  code: string;
  name: string;
  state: string;
  dependency: string;
  municipality?: string;
  parish?: string;
}

const DEPENDENCY_OPTIONS = [
  'Público',
  'Privado',
  'Subsidiado'
];

const SchoolManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [planteles, setPlanteles] = useState<Plantel[]>([]);
  const [filteredPlanteles, setFilteredPlanteles] = useState<Plantel[]>([]);

  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPlantel, setEditingPlantel] = useState<Plantel | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Form
  const [form] = Form.useForm();

  // Search and filters
  const [searchText, setSearchText] = useState('');
  const [filterState, setFilterState] = useState<string | undefined>(undefined);
  const [filterDependency, setFilterDependency] = useState<string | undefined>(undefined);

  // Load planteles
  const fetchPlanteles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/planteles');
      setPlanteles(res.data);
      setFilteredPlanteles(res.data);
    } catch (error) {
      console.error('Error fetching planteles:', error);
      message.error('Error al obtener lista de planteles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlanteles();
  }, [fetchPlanteles]);

  // Filter planteles based on search and filters
  useEffect(() => {
    let filtered = planteles;

    // Text search
    if (searchText) {
      filtered = filtered.filter(plantel =>
        plantel.name.toLowerCase().includes(searchText.toLowerCase()) ||
        plantel.code.toLowerCase().includes(searchText.toLowerCase()) ||
        plantel.state.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // State filter
    if (filterState) {
      filtered = filtered.filter(plantel => plantel.state === filterState);
    }

    // Dependency filter
    if (filterDependency) {
      filtered = filtered.filter(plantel => plantel.dependency === filterDependency);
    }

    setFilteredPlanteles(filtered);
  }, [planteles, searchText, filterState, filterDependency]);

  // Get unique states for filter
  const uniqueStates = [...new Set(planteles.map(p => p.state))].sort();

  // Handle modal open/close
  const handleModalOpen = (plantel?: Plantel) => {
    setEditingPlantel(plantel || null);
    if (plantel) {
      form.setFieldsValue(plantel);
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setEditingPlantel(null);
    form.resetFields();
  };

  // Handle form submit
  const handleSubmit = async (values: PlantelFormValues) => {
    setSubmitLoading(true);
    try {
      if (editingPlantel) {
        // Update
        await api.put(`/planteles/${editingPlantel.id}`, values);
        message.success('Plantel actualizado exitosamente');
      } else {
        // Create
        await api.post('/planteles', values);
        message.success('Plantel creado exitosamente');
      }
      handleModalClose();
      fetchPlanteles(); // Refresh list
    } catch (error) {
      console.error('Error saving plantel:', error);
      message.error('Error al guardar el plantel');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (plantel: Plantel) => {
    try {
      await api.delete(`/planteles/${plantel.id}`);
      message.success('Plantel eliminado exitosamente');
      fetchPlanteles(); // Refresh list
    } catch (error) {
      console.error('Error deleting plantel:', error);
      message.error('Error al eliminar el plantel');
    }
  };

  // Table columns
  const columns = [
    {
      title: 'Código',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      sorter: (a: Plantel, b: Plantel) => a.code.localeCompare(b.code),
    },
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: Plantel, b: Plantel) => a.name.localeCompare(b.name),
      render: (name: string) => (
        <Text strong>{name}</Text>
      )
    },
    {
      title: 'Estado',
      dataIndex: 'state',
      key: 'state',
      width: 150,
      sorter: (a: Plantel, b: Plantel) => a.state.localeCompare(b.state),
    },
    {
      title: 'Dependencia',
      dataIndex: 'dependency',
      key: 'dependency',
      width: 120,
      render: (dependency: string) => (
        <Tag color={dependency === 'Público' ? 'green' : dependency === 'Privado' ? 'blue' : 'orange'}>
          {dependency}
        </Tag>
      )
    },
    {
      title: 'Municipio',
      dataIndex: 'municipality',
      key: 'municipality',
      width: 150,
      render: (municipality: string) => municipality || <Text type="secondary">-</Text>
    },
    {
      title: 'Parroquia',
      dataIndex: 'parish',
      key: 'parish',
      width: 150,
      render: (parish: string) => parish || <Text type="secondary">-</Text>
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: Plantel) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleModalOpen(record)}
            style={{ color: '#1890ff' }}
          >
            Editar
          </Button>
          <Popconfirm
            title="¿Está seguro de eliminar este plantel?"
            description="Esta acción no se puede deshacer."
            onConfirm={() => handleDelete(record)}
            okText="Sí, eliminar"
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              icon={<DeleteOutlined />}
              danger
            >
              Eliminar
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '0 20px' }}>
      <Card
        title={
          <Space>
            <BankOutlined style={{ color: '#1890ff' }} />
            <span style={{ fontSize: '18px', fontWeight: 600 }}>Gestión de Planteles</span>
          </Space>
        }
        style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleModalOpen()}
          >
            Agregar Plantel
          </Button>
        }
      >
        {/* Filters */}
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Search
            placeholder="Buscar por nombre, código o estado..."
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            prefix={<SearchOutlined />}
          />

          <Select
            placeholder="Filtrar por estado"
            allowClear
            style={{ width: 200 }}
            onChange={setFilterState}
          >
            {uniqueStates.map(state => (
              <Option key={state} value={state}>{state}</Option>
            ))}
          </Select>

          <Select
            placeholder="Filtrar por dependencia"
            allowClear
            style={{ width: 200 }}
            onChange={setFilterDependency}
          >
            {DEPENDENCY_OPTIONS.map(dep => (
              <Option key={dep} value={dep}>{dep}</Option>
            ))}
          </Select>
        </Space>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={filteredPlanteles}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} planteles`,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* Modal for Create/Edit */}
      <Modal
        title={editingPlantel ? 'Editar Plantel' : 'Agregar Nuevo Plantel'}
        open={modalVisible}
        onCancel={handleModalClose}
        footer={null}
        destroyOnHidden
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            dependency: 'Público'
          }}
        >
          <Form.Item
            name="code"
            label="Código"
            rules={[
              { required: true, message: 'El código es obligatorio' },
              { max: 20, message: 'Máximo 20 caracteres' }
            ]}
          >
            <Input placeholder="Ej: U.E.N-001" />
          </Form.Item>

          <Form.Item
            name="name"
            label="Nombre del Plantel"
            rules={[
              { required: true, message: 'El nombre es obligatorio' },
              { max: 255, message: 'Máximo 255 caracteres' }
            ]}
          >
            <Input placeholder="Ej: Unidad Educativa Nacional" />
          </Form.Item>

          <Form.Item
            name="state"
            label="Estado"
            rules={[{ required: true, message: 'El estado es obligatorio' }]}
          >
            <Input placeholder="Ej: Distrito Capital" />
          </Form.Item>

          <Form.Item
            name="dependency"
            label="Dependencia"
            rules={[{ required: true, message: 'La dependencia es obligatoria' }]}
          >
            <Select placeholder="Seleccione la dependencia">
              {DEPENDENCY_OPTIONS.map(dep => (
                <Option key={dep} value={dep}>{dep}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="municipality"
            label="Municipio (opcional)"
          >
            <Input placeholder="Ej: Libertador" />
          </Form.Item>

          <Form.Item
            name="parish"
            label="Parroquia (opcional)"
          >
            <Input placeholder="Ej: Catedral" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleModalClose}>
                Cancelar
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitLoading}
              >
                {editingPlantel ? 'Actualizar' : 'Crear'} Plantel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SchoolManagement;
