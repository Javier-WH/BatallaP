import React, { useState, useEffect } from 'react';
import { Input, Table, Card, Button, Space, Tag, message } from 'antd';
import { SearchOutlined, EditOutlined } from '@ant-design/icons';
import api from '@/services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const { Search } = Input;

const SearchUsers: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Check if current user has Master role
  const isMaster = user?.roles?.includes('Master') || false;

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

  // Determine the base path based on user role
  const getBasePath = () => {
    if (isMaster) return '/master';
    return '/admin';
  };

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
          {record.roles?.map((role: any) => {
            // Color coding for different roles
            let color = 'blue';
            if (role.name === 'Master') color = 'purple';
            else if (role.name === 'Admin') color = 'gold';
            else if (role.name === 'Teacher') color = 'green';
            else if (role.name === 'Student') color = 'cyan';
            else if (role.name === 'Tutor') color = 'magenta';

            return <Tag key={role.id} color={color}>{role.name}</Tag>;
          })}
        </Space>
      )
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button
          type="link"
          icon={<EditOutlined />}
          onClick={() => navigate(`${getBasePath()}/edit/${record.id}`)}
        >
          Editar
        </Button>
      )
    }
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Card
        title="Buscar y Editar Usuarios"
        extra={
          isMaster && (
            <Tag color="purple" style={{ margin: 0 }}>Modo Master</Tag>
          )
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Search
            placeholder="Buscar por nombre o cédula"
            allowClear
            enterButton={<Button icon={<SearchOutlined />}>Buscar</Button>}
            size="large"
            onSearch={fetchUsers}
            onChange={(e) => {
              if (!e.target.value) fetchUsers(''); // Auto reload on clear
            }}
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

export default SearchUsers;
