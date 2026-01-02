import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button, Tooltip } from 'antd';
import {
  DashboardOutlined,
  UserAddOutlined,
  TeamOutlined,
  BookOutlined,
  QuestionCircleOutlined,
  ProjectOutlined
} from '@ant-design/icons';

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

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const tools = [
    { path: '/admin', icon: <DashboardOutlined />, label: 'Panel', tooltip: 'Panel Principal Admin' },
    { path: '/admin/inscribir-estudiante', icon: <UserAddOutlined />, label: 'Estudiantes', tooltip: 'Solicitudes de Ingreso' },
    { path: '/admin/matricular-estudiante', icon: <UserAddOutlined />, label: 'Matrícula', tooltip: 'Matriculación de Estudiantes' },
    { path: '/admin/register-staff', icon: <TeamOutlined />, label: 'Personal', tooltip: 'Profesores y Representantes' },
    { path: '/admin/projection', icon: <ProjectOutlined />, label: 'Proyección', tooltip: 'Asignación Académica' },
    { path: '/admin/planteles', icon: <BookOutlined />, label: 'Planteles', tooltip: 'Planteles Escolares' },
    { path: '/admin/enrollment-questions', icon: <QuestionCircleOutlined />, label: 'Preguntas', tooltip: 'Encuesta de Inscripción' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Admin Sub-Navigation */}
      <div className="sticky top-0 z-40 bg-slate-50/80 backdrop-blur-md pb-4 pt-0 px-6">
        <div className="bg-white/70 backdrop-blur-sm p-2 rounded-2xl border border-white flex items-center gap-2 shadow-sm overflow-x-auto scrollbar-hide">
          <div className="px-4 py-1 border-r border-slate-200 mr-2 shrink-0">
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em]">Admisión</span>
          </div>
          {tools.map(tool => (
            <NavButton
              key={tool.path}
              {...tool}
              active={isActive(tool.path)}
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

export default AdminLayout;
