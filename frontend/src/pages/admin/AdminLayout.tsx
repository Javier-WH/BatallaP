import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button, Space, Card, Tooltip } from 'antd';
import { DashboardOutlined, TeamOutlined, UserAddOutlined, SearchOutlined } from '@ant-design/icons';

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', marginTop: -24, marginLeft: -24, marginRight: -24 }}>
      {/* Admin Toolbar */}
      <Card
        size="small"
        bodyStyle={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '16px' }}
        style={{ borderRadius: 0, borderBottom: '1px solid #f0f0f0', boxShadow: 'none' }}
      >
        <span style={{ fontWeight: 600, color: '#666', marginRight: 8, borderRight: '1px solid #eee', paddingRight: 16 }}>
          ADMIN TOOLS
        </span>
        <Space>
          <Tooltip title="Panel Principal Admin">
            <Button
              type={isActive('/admin') ? 'primary' : 'text'}
              icon={<DashboardOutlined />}
              onClick={() => navigate('/admin')}
            >
              Panel
            </Button>
          </Tooltip>

          <Tooltip title="Inscribir Profesor o Representante">
            <Button
              type={isActive('/admin/register-staff') ? 'primary' : 'text'}
              icon={<UserAddOutlined />}
              onClick={() => navigate('/admin/register-staff')}
            >
              Inscribir Personal
            </Button>
          </Tooltip>

          <Tooltip title="Inscribir nuevo Estudiante">
            <Button
              type={isActive('/admin/enroll-student') ? 'primary' : 'text'}
              icon={<UserAddOutlined />}
              onClick={() => navigate('/admin/enroll-student')}
            >
              Inscribir Estudiante
            </Button>
          </Tooltip>

          <Tooltip title="Lista de Estudiantes Inscritos">
            <Button
              type={isActive('/admin/enrolled') ? 'primary' : 'text'}
              icon={<TeamOutlined />}
              onClick={() => navigate('/admin/enrolled')}
            >
              Estudiantes
            </Button>
          </Tooltip>

          <Tooltip title="Buscar y editar usuarios (excepto roles administrativos)">
            <Button
              type={isActive('/admin/search') ? 'primary' : 'text'}
              icon={<SearchOutlined />}
              onClick={() => navigate('/admin/search')}
            >
              Buscar / Editar
            </Button>
          </Tooltip>
        </Space>
      </Card>

      {/* Module Content */}
      <div style={{ flex: 1, padding: 24 }}>
        <Outlet />
      </div>
    </div>
  );
};

export default AdminLayout;
