import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button, Tooltip } from 'antd';
import { IdcardOutlined, UserSwitchOutlined } from '@ant-design/icons';

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

const DirectorLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isExact = (path: string) => location.pathname === path;

  const tools = [
    { path: '/director/encargado', icon: <UserSwitchOutlined />, label: 'Director Encargado', tooltip: 'Designar Director Encargado', exact: true },
    { path: '/director/coordinador', icon: <IdcardOutlined />, label: 'Coordinador', tooltip: 'Designar Coordinador de Control de Estudios', exact: true },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0 overflow-x-hidden">
      {/* Director Toolbar */}
      <div className="sticky top-0 z-40 backdrop-blur-md pb-4 pt-0 px-6">
        <div className="bg-white/70 backdrop-blur-sm p-2 rounded-2xl border border-white/50 flex items-center gap-2 shadow-sm">
          <div className="px-4 py-1 border-r border-slate-200/50 mr-2 shrink-0">
            <span className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em]">Director</span>
          </div>
          {tools.map(tool => (
            <NavButton
              key={tool.path}
              {...tool}
              active={isExact(tool.path)}
              onClick={() => navigate(tool.path)}
            />
          ))}
        </div>
      </div>

      {/* Module Content */}
      <div className="flex-1 min-h-0 min-w-0 pt-0">
        <div className="h-full min-w-0 overflow-x-hidden overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default DirectorLayout;
