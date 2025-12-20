import React, { useState, useEffect } from 'react';
import { Input, Table, Card, Button, Space, Tag, message } from 'antd';
import { SearchOutlined, EditOutlined } from '@ant-design/icons';
import api from '@/services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface Role {
  id: number;
  name: string;
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
  document: string;
  roles: Role[];
}

const { Search } = Input;

const SearchUsers: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<User[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Check if current user has Master role (Spanish: Master)
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
    return '/admin';
  };

  const columns = [
    {
      title: 'Nombre',
      key: 'fullName',
      render: (_: unknown, record: User) => `${record.firstName} ${record.lastName}`
    },
    {
      title: 'Documento',
      dataIndex: 'document',
      key: 'document',
    },
    {
      title: 'Roles',
      key: 'roles',
      render: (_: unknown, record: User) => {
        const roleOrder: { [key: string]: number } = {
          'Master': 1,
          'Administrador': 2,
          'Control de Estudios': 3,
          'Profesor': 4,
          'Representante': 5,
          'Alumno': 6
        };

        const wowColors: { [key: string]: { color: string, textColor: string, border?: string } } = {
          'Master': { color: '#ff8000', textColor: '#fff' }, // Legendary
          'Administrador': { color: '#a335ee', textColor: '#fff' },  // Epic
          'Control de Estudios': { color: '#0070dd', textColor: '#fff' }, // Rare
          'Profesor': { color: '#1eff00', textColor: '#000' }, // Uncommon
          'Representante': { color: '#ffffff', textColor: '#333', border: '1px solid #d9d9d9' },  // Common
          'Alumno': { color: '#9d9d9d', textColor: '#fff' } // Trash
        };

        const sortedRoles = [...(record.roles || [])].sort((a, b) => {
          return (roleOrder[a.name] || 99) - (roleOrder[b.name] || 99);
        });

        return (
          <Space size={4} wrap>
            {sortedRoles.map((role: Role) => {
              const style = wowColors[role.name] || { color: '#ccc', textColor: '#fff' };
              return (
                <Tag
                  key={role.id}
                  style={{
                    backgroundColor: style.color,
                    color: style.textColor,
                    border: style.border || 'none',
                    fontWeight: 600
                  }}
                >
                  {role.name}
                </Tag>
              );
            })}
          </Space>
        );
      }
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: unknown, record: User) => (
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
