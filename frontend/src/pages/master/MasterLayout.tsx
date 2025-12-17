import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button, Space, Card, Tooltip } from 'antd';
import { DashboardOutlined, UserAddOutlined, SearchOutlined, BankOutlined } from '@ant-design/icons';

const MasterLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', marginTop: -24, marginLeft: -24, marginRight: -24 }}>
      {/* Master Toolbar */}
      <Card
        size="small"
        bodyStyle={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '16px' }}
        style={{ borderRadius: 0, borderBottom: '1px solid #f0f0f0', boxShadow: 'none' }}
      >
        <span style={{ fontWeight: 600, color: '#666', marginRight: 8, borderRight: '1px solid #eee', paddingRight: 16 }}>
          MASTER TOOLS
        </span>
        <Space>
          <Tooltip title="Panel Principal">
            <Button
              type={isActive('/master') ? 'primary' : 'text'}
              icon={<DashboardOutlined />}
              onClick={() => navigate('/master')}
            >
              Panel
            </Button>
          </Tooltip>

          <Tooltip title="Inscribir un nuevo usuario en el sistema">
            <Button
              type={isActive('/master/register') ? 'primary' : 'text'}
              icon={<UserAddOutlined />}
              onClick={() => navigate('/master/register')}
            >
              Inscribir
            </Button>
          </Tooltip>

          <Tooltip title="Buscar y editar usuarios">
            <Button
              type={isActive('/master/search') ? 'primary' : 'text'}
              icon={<SearchOutlined />}
              onClick={() => navigate('/master/search')}
            >
              Buscar / Editar
            </Button>
          </Tooltip>

          <Tooltip title="Gestión de Periodos, Grados y Secciones">
            <Button
              type={isActive('/master/academic') ? 'primary' : 'text'}
              icon={<BankOutlined />}
              onClick={() => navigate('/master/academic')}
            >
              Académico
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

export default MasterLayout;
