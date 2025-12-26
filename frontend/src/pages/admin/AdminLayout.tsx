import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button, Tooltip } from 'antd';
import {
  DashboardOutlined,
  UserAddOutlined,
  TeamOutlined,
  BankOutlined,
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
    { path: '/admin/register-staff', icon: <TeamOutlined />, label: 'Personal', tooltip: 'Profesores y Representantes' },
    { path: '/admin/projection', icon: <ProjectOutlined />, label: 'Proyección', tooltip: 'Asignación Académica' },
    { path: '/admin/academic', icon: <BankOutlined />, label: 'Académico', tooltip: 'Gestión de Estructura' },
    { path: '/admin/planteles', icon: <BookOutlined />, label: 'Planteles', tooltip: 'Planteles Escolares' },
    { path: '/admin/enrollment-questions', icon: <QuestionCircleOutlined />, label: 'Preguntas', tooltip: 'Encuesta de Inscripción' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Admin Sub-Navigation */}
      <div className="bg-white/50 backdrop-blur-sm p-2 rounded-2xl border border-white flex items-center gap-2 shadow-sm overflow-x-auto scrollbar-hide">
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

      {/* Module Content */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <Outlet />
      </div>
    </div>
  );
};

export default AdminLayout;
