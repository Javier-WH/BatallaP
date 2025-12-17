import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button, Space, Card, Tooltip } from 'antd';
import { DashboardOutlined, UserAddOutlined } from '@ant-design/icons';

const MasterLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Master Toolbar */}
      <Card
        size="small"
        bodyStyle={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '16px' }}
        style={{ borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
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
        </Space>
      </Card>

      {/* Module Content */}
      <div style={{ flex: 1 }}>
        <Outlet />
      </div>
    </div>
  );
};

export default MasterLayout;
