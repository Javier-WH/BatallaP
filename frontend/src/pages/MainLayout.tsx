import React, { useState } from 'react';
import { Layout, Button, Tooltip, Badge, Modal } from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  UserOutlined,
  LogoutOutlined,
  DashboardOutlined,
  BookOutlined,
  FileTextOutlined,
  SearchOutlined,
  SettingOutlined,
  BellOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { logout, user } = useAuth();
  const { settings, activePeriod } = useSchool();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    Modal.confirm({
      title: <span className="text-slate-900 font-black">¿Cerrar sesión?</span>,
      icon: <LogoutOutlined className="text-red-500" />,
      content: <span className="text-slate-500 font-medium">¿Estás seguro de que deseas salir del sistema? Todos los cambios no guardados se perderán.</span>,
      okText: 'Sí, Salir',
      cancelText: 'Permanecer aquí',
      okButtonProps: {
        danger: true,
        className: 'rounded-xl font-bold h-10',
        type: 'primary'
      },
      cancelButtonProps: {
        className: 'rounded-xl font-bold h-10'
      },
      centered: true,
      onOk() {
        logout();
        navigate('/');
      },
    });
  }

  const allMenuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
      roles: ['Master', 'Administrador', 'Profesor', 'Control de Estudios', 'Representante', 'Alumno'],
      path: '/dashboard'
    },
    {
      key: 'master-module',
      icon: <SettingOutlined />,
      label: 'Maestro',
      roles: ['Master'],
      path: '/master'
    },
    {
      key: 'admin-module',
      icon: <UserOutlined />,
      label: 'Administrador',
      roles: ['Administrador'],
      path: '/admin'
    },
    {
      key: 'control-estudios-module',
      icon: <FileTextOutlined />,
      label: 'Control Estudios',
      roles: ['Control de Estudios'],
      path: '/control-estudios'
    },
    {
      key: 'search-users',
      icon: <SearchOutlined />,
      label: 'Usuarios',
      roles: ['Master', 'Administrador'],
      path: '/gestion-usuarios'
    },

    {
      key: 'profesor-module',
      icon: <BookOutlined />,
      label: 'Académico',
      roles: ['Profesor'],
      path: '/profesor'
    }
  ];

  const menuItems = allMenuItems.filter(item =>
    user?.roles.some(userRole => item.roles.includes(userRole))
  );

  return (
    <Layout className="h-screen bg-slate-50 overflow-hidden">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={260}
        className="premium-sidebar relative"
      >
        <div className="flex flex-col h-full overflow-hidden relative">
          {/* Institution Header */}
          <div className="p-6 flex items-start gap-4 border-b border-white/5 overflow-hidden">
            <div
              className="shrink-0 w-14 h-14 bg-white/90 p-2 shadow-2xl shadow-blue-500/20 flex items-center justify-center overflow-hidden border border-white/20"
              style={{ borderRadius: settings.logoShape === 'circle' ? '50%' : '0.75rem' }}
            >
              <img
                src={settings.logo}
                alt="Logo"
                className="w-full h-full object-contain"
                style={{ borderRadius: settings.logoShape === 'circle' ? '50%' : '0' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/2940/2940651.png';
                }}
              />
            </div>
            {!collapsed && (
              <div className="flex flex-col flex-1 min-w-0 text-white">
                <span
                  className="text-sm font-bold tracking-tight leading-tight"
                  style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}
                >
                  {settings.name}
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-1">Gestión Educativa</span>
              </div>
            )}
          </div>

          {/* Navigation Menu */}
          <div className="flex-1 overflow-y-auto py-4">
            {menuItems.map(item => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <div
                  key={item.key}
                  onClick={() => navigate(item.path)}
                  className={isActive ? 'nav-item-active' : 'nav-item'}
                >
                  <span className="text-lg flex shrink-0 items-center justify-center">{item.icon}</span>
                  {!collapsed && <span className="font-semibold text-sm">{item.label}</span>}
                </div>
              );
            })}
          </div>

          {/* User Profile Summary */}
          {!collapsed && (
            <div className="p-4 mx-2 mb-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center text-white border-2 border-white/20">
                  <UserOutlined />
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-sm font-bold text-white truncate">{user?.firstName} {user?.lastName}</span>
                  <span className="text-[10px] text-slate-400 font-medium truncate italic">{user?.roles[0]}</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Floating Collapse Trigger */}
        <div className="absolute top-1/2 -right-3 z-50">
          <Button
            shape="circle"
            size="small"
            icon={collapsed ? <RightOutlined /> : <LeftOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center bg-white border border-slate-200 shadow-xl hover:scale-110 transition-all text-slate-500 hover:text-brand-primary"
          />
        </div>
      </Sider>

      <Layout className="h-screen flex flex-col">
        <Header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 h-20 flex items-center justify-between z-50 shrink-0">
          <div className="flex items-center gap-4">
            {/* Global Context Indicator: Active Period */}
            {activePeriod && (
              <div className="ml-2 hidden md:flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-500">
                <div className="w-10 h-10 rounded-xl bg-blue-50/50 flex items-center justify-center text-brand-primary border border-blue-100/50">
                  <CalendarOutlined className="text-lg" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-white/80 uppercase tracking-[0.2em] leading-none mb-1">
                    Periodo Activo
                  </span>
                  <span className="text-sm font-black text-white leading-tight drop-shadow-sm">
                    {activePeriod.name}
                  </span>
                </div>
                <Badge status="processing" className="ml-1" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Tooltip title="Notificaciones">
              <Button shape="circle" icon={<BellOutlined />} className="border-none shadow-none hover:bg-slate-100" />
            </Tooltip>
            <div className="h-8 w-[1px] bg-slate-200" />
            <Button
              danger
              type="primary"
              ghost
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              className="rounded-xl font-bold border-2"
            >
              Cerrar Sesión
            </Button>
          </div>
        </Header>

        <Content className="flex-1 overflow-hidden bg-slate-50 relative">
          <div className="absolute inset-0 overflow-y-auto">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
