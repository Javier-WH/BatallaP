import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button, Space, Card, Tooltip } from 'antd';
import { DashboardOutlined, SettingOutlined, UserAddOutlined, CheckCircleFilled } from '@ant-design/icons';

const ControlEstudiosLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const matchesPath = (path: string) => location.pathname.startsWith(path);
  const isExact = (path: string) => location.pathname === path;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', marginTop: -24, marginLeft: -24, marginRight: -24 }}>
      {/* Control de Estudios Toolbar */}
      <Card
        size="small"
        styles={{ body: { padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '16px' } }}
        style={{ borderRadius: 0, borderBottom: '1px solid #f0f0f0', boxShadow: 'none' }}
      >
        <span style={{ fontWeight: 600, color: '#666', marginRight: 8, borderRight: '1px solid #eee', paddingRight: 16 }}>
          CONTROL DE ESTUDIOS
        </span>
        <Space>
          <Tooltip title="Panel Principal">
            <Button
              type={isExact('/control-estudios') ? 'primary' : 'text'}
              icon={<DashboardOutlined />}
              onClick={() => navigate('/control-estudios')}
            >
              Panel
            </Button>
          </Tooltip>
          <Tooltip title="Matricular Estudiantes">
            <Button
              type={matchesPath('/control-estudios/matricular-estudiante') ? 'primary' : 'text'}
              icon={<UserAddOutlined />}
              onClick={() => navigate('/control-estudios/matricular-estudiante')}
            >
              Matricular
            </Button>
          </Tooltip>
          <Tooltip title="Configuración Académica">
            <Button
              type={matchesPath('/control-estudios/configuracion') ? 'primary' : 'text'}
              icon={<SettingOutlined />}
              onClick={() => navigate('/control-estudios/configuracion')}
            >
              Configuración Académica
            </Button>
          </Tooltip>
          <Tooltip title="Consejos de Curso">
            <Button
              type={matchesPath('/control-estudios/consejos-curso') ? 'primary' : 'text'}
              icon={<CheckCircleFilled />}
              onClick={() => navigate('/control-estudios/consejos-curso')}
            >
              Consejos de Curso
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

export default ControlEstudiosLayout;
