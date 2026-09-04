import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button, Tooltip, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { DashboardOutlined, SettingOutlined, UserAddOutlined, CheckCircleFilled, LockOutlined, ProjectOutlined, EditOutlined, DownOutlined, FileExcelOutlined, ToolOutlined, SwapOutlined, TrophyOutlined, AlertOutlined, HistoryOutlined, CalendarOutlined, FlagOutlined, FileProtectOutlined, IdcardOutlined } from '@ant-design/icons';

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

  const matchesPath = (path: string) => location.pathname.startsWith(path);
  const isExact = (path: string) => location.pathname === path;

  const tools = [
    { path: '/director', icon: <DashboardOutlined />, label: 'Panel', tooltip: 'Panel Principal', exact: true },
    { path: '/director/matricular-estudiante', icon: <UserAddOutlined />, label: 'Matrícula', tooltip: 'Matriculación de Estudiantes' },
    { path: '/director/configuracion', icon: <SettingOutlined />, label: 'Configuración', tooltip: 'Ajustes Académicos' },
    { path: '/director/consejos-curso', icon: <CheckCircleFilled />, label: 'Consejos', tooltip: 'Consejos de Curso y Evaluación' },
    { path: '/director/proyeccion', icon: <ProjectOutlined />, label: 'Proyección', tooltip: 'Asignación Académica' },
    { path: '/director/horarios', icon: <CalendarOutlined />, label: 'Horarios', tooltip: 'Gestión de Horarios' },
    { path: '/director/resumen-rendimiento', icon: <FileExcelOutlined />, label: 'Resumen', tooltip: 'Resumen de Rendimiento Estudiantil' },
    { path: '/director/promedios-generales', icon: <TrophyOutlined />, label: 'Promedios', tooltip: 'Promedios Generales y Posiciones' },
    { path: '/director/reparacion', icon: <ToolOutlined />, label: 'Revisión', tooltip: 'Período de Revisión de Materias' },
    { path: '/director/materia-pendiente', icon: <AlertOutlined />, label: 'Materia Pendiente', tooltip: 'Gestión de Materias Pendientes' },
    { path: '/director/ajustes', icon: <IdcardOutlined />, label: 'Coordinador', tooltip: 'Datos del Coordinador de Control de Estudios' },
  ];

  const notasItems: MenuProps['items'] = [
    { key: '/director/calificaciones', icon: <EditOutlined />, label: 'Notas Actuales' },
    { key: '/director/notas-historicas', icon: <HistoryOutlined />, label: 'Notas Históricas' },
    { key: '/director/editar-notas', icon: <LockOutlined />, label: 'Notas Históricas (Legacy)' },
    { key: '/director/notas-externas', icon: <SwapOutlined />, label: 'Notas Externas' },
  ];

  const cierreAnualItems: MenuProps['items'] = [
    { key: '/director/titulos', icon: <FileProtectOutlined />, label: 'Impresión de Títulos' },
    { key: '/director/cierre-anual', icon: <FlagOutlined />, label: 'Prosecución del Cierre Anual', disabled: true },
  ];

  const isNotasActive = location.pathname === '/director/calificaciones'
    || location.pathname === '/director/editar-notas'
    || location.pathname === '/director/notas-historicas'
    || location.pathname.startsWith('/director/notas-externas');

  const isCierreAnualActive = location.pathname.startsWith('/director/titulos')
    || location.pathname.startsWith('/director/cierre-anual');

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
              active={tool.exact ? isExact(tool.path) : matchesPath(tool.path)}
              onClick={() => navigate(tool.path)}
            />
          ))}
          <Dropdown
            menu={{
              items: notasItems,
              onClick: ({ key }) => navigate(key),
            }}
            trigger={['click']}
          >
            <Button
              type="text"
              style={{ border: 'none', boxShadow: 'none' }}
              className={`
                h-10 px-4 flex items-center gap-2 rounded-xl transition-all font-semibold
                ${isNotasActive
                  ? 'bg-brand-primary text-white shadow-lg shadow-blue-500/30'
                  : 'text-slate-500 hover:bg-slate-100'
                }
              `}
            >
              <EditOutlined />
              <span className="text-sm">Notas</span>
              <DownOutlined style={{ fontSize: 10 }} />
            </Button>
          </Dropdown>
          <Dropdown
            menu={{
              items: cierreAnualItems,
              onClick: ({ key }) => navigate(key),
            }}
            trigger={['click']}
          >
            <Button
              type="text"
              style={{ border: 'none', boxShadow: 'none' }}
              className={`
                h-10 px-4 flex items-center gap-2 rounded-xl transition-all font-semibold
                ${isCierreAnualActive
                  ? 'bg-brand-primary text-white shadow-lg shadow-blue-500/30'
                  : 'text-slate-500 hover:bg-slate-100'
                }
              `}
            >
              <FlagOutlined />
              <span className="text-sm">Procesos Finales</span>
              <DownOutlined style={{ fontSize: 10 }} />
            </Button>
          </Dropdown>
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
