import React, { useState, useEffect } from 'react';
import { Input, Table, Card, Button, Space, Tag, message } from 'antd';
import { SearchOutlined, EditOutlined } from '@ant-design/icons';
import api from '@/services/api';
import { useNavigate } from 'react-router-dom';

const { Search } = Input;

const SearchUsersAdmin: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const navigate = useNavigate();

  const fetchUsers = async (q: string = '') => {
    setLoading(true);
    try {
      const response = await api.get(`/users?q=${q}`);
      setData(response.data);
    } catch (error) {
      console.error(error);
      message.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const columns = [
    {
      title: 'Nombre',
      key: 'fullName',
      render: (_: any, record: any) => `${record.firstName} ${record.lastName}`
    },
    {
      title: 'Documento',
      dataIndex: 'document',
      key: 'document',
    },
    {
      title: 'Usuario',
      key: 'username',
      render: (_: any, record: any) => record.user?.username || 'N/A'
    },
    {
      title: 'Roles',
      key: 'roles',
      render: (_: any, record: any) => (
        <Space size={0} wrap>
          {record.roles?.map((role: any) => <Tag key={role.id} color="blue">{role.name}</Tag>)}
        </Space>
      )
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: any, record: any) => {
        // Check valid roles to edit
        const isProtected = record.roles?.some((r: any) => r.name === 'Master' || r.name === 'Admin');
        // Admin can edit anyone but NOT Master/Admin credentials ideally, but for now allow edit EXCEPT role change logic handled in Edit form
        // User requirement: "no se debe poder cambiar el rol de master ni de admin".
        // Usually lower admins shouldn't edit Master accounts.
        // Let's allow clicking edit but the Edit form will be restrictive.

        return (
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/admin/edit/${record.id}`)}
          >
            Editar
          </Button>
        )
      }
    }
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Card title="Buscar y Editar (Modo Admin)">
        <div style={{ marginBottom: 16 }}>
          <Search
            placeholder="Buscar por nombre o cédula"
            allowClear
            enterButton={<Button icon={<SearchOutlined />}>Buscar</Button>}
            size="large"
            onSearch={fetchUsers}
          />
        </div>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default SearchUsersAdmin;
