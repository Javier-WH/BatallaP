import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button, Tooltip } from 'antd';
import { DashboardOutlined, SettingOutlined, UserAddOutlined, CheckCircleFilled, BookOutlined } from '@ant-design/icons';

const NavButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon, label, tooltip, active, onClick }) => (
  <Tooltip title={tooltip} placement="bottom">
    <Button
      type="text"
      icon={icon}
      onClick={onClick}
      className={`
        h-10 px-4 flex items-center gap-2 rounded-xl transition-all font-semibold
        ${active
          ? 'bg-brand-primary text-white shadow-lg shadow-blue-500/30'
          : 'text-slate-500 hover:bg-slate-100'
        }
      `}
    >
      <span className="text-sm">{label}</span>
    </Button>
  </Tooltip>
);

const ControlEstudiosLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const matchesPath = (path: string) => location.pathname.startsWith(path);
  const isExact = (path: string) => location.pathname === path;

  const tools = [
    { path: '/control-estudios', icon: <DashboardOutlined />, label: 'Panel', tooltip: 'Panel Principal', exact: true },
    { path: '/control-estudios/matricular-estudiante', icon: <UserAddOutlined />, label: 'Matricula', tooltip: 'Matriculación de Estudiantes' },
    { path: '/control-estudios/academic', icon: <BookOutlined />, label: 'Académico', tooltip: 'Gestión Académica' },
    { path: '/control-estudios/configuracion', icon: <SettingOutlined />, label: 'Configuración', tooltip: 'Ajustes Académicos' },
    { path: '/control-estudios/consejos-curso', icon: <CheckCircleFilled />, label: 'Consejos', tooltip: 'Consejos de Curso y Evaluación' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Control de Estudios Toolbar */}
      <div className="sticky top-0 z-40 bg-slate-50/80 backdrop-blur-md pb-4 pt-0 px-6">
        <div className="bg-white/70 backdrop-blur-sm p-2 rounded-2xl border border-white flex items-center gap-2 shadow-sm">
          <div className="px-4 py-1 border-r border-slate-200 mr-2 shrink-0">
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em]">Académico</span>
          </div>
          {tools.map(tool => (
            <NavButton
              key={tool.path}
              {...tool}
              active={tool.exact ? isExact(tool.path) : matchesPath(tool.path)}
              onClick={() => navigate(tool.path)}
            />
          ))}
        </div>
      </div>

      {/* Module Content */}
      <div className="flex-1 min-h-0 pt-0">
        <div className="h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default ControlEstudiosLayout;
