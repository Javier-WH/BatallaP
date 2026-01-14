import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Input, Table, Card, Button, Space, Tag, message, Segmented, Typography, Tooltip } from 'antd';
import { SearchOutlined, EditOutlined } from '@ant-design/icons';
import api from '@/services/api';
import { useNavigate, useLocation } from 'react-router-dom';
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
const { Title, Text } = Typography;

const ROLE_FILTERS = [
  { label: 'Todos', value: 'Todos' },
  { label: 'Master', value: 'Master' },
  { label: 'Administradores', value: 'Administrador' },
  { label: 'Control de Estudios', value: 'Control de Estudios' },
  { label: 'Profesores', value: 'Profesor' },
  { label: 'Representantes', value: 'Representante' },
  { label: 'Alumnos', value: 'Alumno' }
] as const;

const SearchUsers: React.FC<{ initialRoleFilter?: string }> = ({ initialRoleFilter = 'Todos' }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<User[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>(initialRoleFilter);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Check current user roles
  const currentRoles = user?.roles ?? [];
  const isMaster = currentRoles.includes('Master');
  const isAdminUser = currentRoles.includes('Administrador');
  const isControlUser = currentRoles.includes('Control de Estudios');

  const moduleBasePath = useMemo(() => {
    if (location.pathname.startsWith('/master')) return '/master';
    if (location.pathname.startsWith('/control-estudios')) return '/control-estudios';
    if (location.pathname.startsWith('/gestion-usuarios')) return '/gestion-usuarios';
    return '/admin';
  }, [location.pathname]);

  const fetchUsers = async (q: string = '') => {
    setLoading(true);
    try {
      const response = await api.get(`/users?q=${q}&activeOnly=true`);
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

  const canEditTarget = useCallback((roles: Role[] = []) => {
    const roleNames = roles.map(role => role.name);
    const targetHasMaster = roleNames.includes('Master');
    const targetHasAdmin = roleNames.includes('Administrador');
    const targetHasControl = roleNames.includes('Control de Estudios');

    if (isMaster) return true;
    if (isAdminUser) {
      return !targetHasMaster && !targetHasAdmin;
    }
    if (isControlUser) {
      return !targetHasMaster && !targetHasAdmin && !targetHasControl;
    }
    return false;
  }, [isMaster, isAdminUser, isControlUser]);

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
      render: (_: unknown, record: User) => {
        const editable = canEditTarget(record.roles || []);
        const button = (
          <Button
            type="link"
            icon={<EditOutlined />}
            disabled={!editable}
            onClick={() => {
              if (!editable) return;
              navigate(`${moduleBasePath}/edit/${record.id}`);
            }}
          >
            Editar
          </Button>
        );

        if (editable) return button;
        return (
          <Tooltip title="No tienes permisos para editar este usuario">
            <span>{button}</span>
          </Tooltip>
        );
      }
    }
  ];

  const filteredData = useMemo(() => {
    if (roleFilter === 'Todos') return data;
    return data.filter(user => user.roles?.some(role => role.name === roleFilter));
  }, [data, roleFilter]);

  const roleStats = useMemo(() => {
    const stats: Record<string, number> = {};
    ROLE_FILTERS.forEach(filter => {
      if (filter.value !== 'Todos') {
        stats[filter.value] = data.filter(user => user.roles?.some(role => role.name === filter.value)).length;
      }
    });
    return stats;
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-slate-900 text-white p-6 md:p-10 shadow-2xl">
        <div className="space-y-3">
          <Tag color="gold" className="border-none font-bold uppercase tracking-[0.3em] text-[10px] px-3 py-1 rounded-full">
            Gestión de Usuarios
          </Tag>
          <Title level={2} style={{ color: '#fff', margin: 0 }}>Directorio unificado</Title>
          <Text style={{ color: 'rgba(255,255,255,0.7)' }}>
            Filtra rápidamente por rol y encuentra a cualquier miembro de la comunidad educativa.
          </Text>
          <div className="pt-4 flex flex-wrap gap-4 text-sm text-white/80">
            <span>Total registrados: <strong>{data.length}</strong></span>
            <span>Vista actual: <strong>{roleFilter === 'Todos' ? 'Todos los roles' : roleFilter}</strong></span>
          </div>
        </div>
      </div>

      <Card
        className="border-none shadow-lg rounded-3xl"
        bodyStyle={{ padding: '24px 24px 32px' }}
        title={
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <Title level={4} style={{ margin: 0 }}>Buscar y editar usuarios</Title>
              <Text type="secondary">Control centralizado de perfiles</Text>
            </div>
            {isMaster && (
              <Tag color="purple" style={{ margin: 0 }}>Modo Master</Tag>
            )}
          </div>
        }
      >
        <Space direction="vertical" size="large" className="w-full">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1 w-full">
              <Search
                placeholder="Buscar por nombre o cédula"
                allowClear
                value={searchValue}
                enterButton={<Button icon={<SearchOutlined />}>Buscar</Button>}
                size="large"
                onSearch={(value) => {
                  setSearchValue(value);
                  fetchUsers(value);
                }}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchValue(value);
                  if (!value) fetchUsers('');
                }}
              />
            </div>
            <Segmented
              size="large"
              value={roleFilter}
              onChange={(val) => setRoleFilter(val.toString())}
              options={ROLE_FILTERS.map(filter => ({ label: filter.label, value: filter.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {ROLE_FILTERS.filter(filter => filter.value !== 'Todos').map(filter => (
              <div
                key={filter.value}
                className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-[11px] uppercase text-slate-500 tracking-[0.3em] mb-1">{filter.label}</p>
                  <p className="text-xl font-bold text-slate-900">{roleStats[filter.value] || 0}</p>
                </div>
              </div>
            ))}
          </div>

          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Space>
      </Card>
    </div>
  );
};

export default SearchUsers;
