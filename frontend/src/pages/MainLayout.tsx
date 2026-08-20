import React, { useState } from 'react';
import { Layout, Button, Badge, Modal, Dropdown, Tag } from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  UserOutlined,
  LogoutOutlined,
  DashboardOutlined,
  BookOutlined,
  FileTextOutlined,
  SettingOutlined,
  CalendarOutlined,
  TeamOutlined,
  SolutionOutlined,
  EyeOutlined,
  LockOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { logout, user } = useAuth();
  const { settings, viewPeriod, allPeriods, isReadOnly, setViewPeriod, resetViewPeriod } = useSchool();
  const navigate = useNavigate();
  const location = useLocation();

  const canSeePreinscripcion = user?.roles?.some(r => r === 'Master' || r === 'Administrador');
  const visiblePeriods = allPeriods.filter(p => p.status !== 'preinscripcion' || canSeePreinscripcion);

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
      key: 'profesor-module',
      icon: <BookOutlined />,
      label: 'Académico',
      roles: ['Profesor'],
      path: '/profesor'
    },
    {
      key: 'representative-module',
      icon: <TeamOutlined />,
      label: 'Representante',
      roles: ['Representante'],
      path: '/representante'
    },
    {
      key: 'student-module',
      icon: <SolutionOutlined />,
      label: 'Mi Expediente',
      roles: ['Alumno'],
      path: '/estudiante'
    }
  ];

  const menuItems = allMenuItems.filter(item =>
    user?.roles.some(userRole => item.roles.includes(userRole))
  );

  return (
    <Layout className="h-screen overflow-hidden theme-page-bg">
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
              <div className="flex flex-col flex-1 min-w-0 text-header-text">
                <span
                  className="text-sm font-bold tracking-tight leading-tight"
                  style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}
                >
                  {settings.name}
                </span>
                <span className="text-[10px] uppercase font-bold text-header-text/70 tracking-widest mt-1">Gestión Educativa</span>
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
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-white/20 shadow-inner"
                  style={{ backgroundColor: 'var(--color-panel-header)' }}
                >
                  <UserOutlined className="text-header-text" />
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-sm font-bold truncate text-header-text">{user?.firstName} {user?.lastName}</span>
                  <span className="text-[10px] font-medium truncate italic text-header-text opacity-60">{user?.roles[0]}</span>
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

      <Layout className="h-screen flex flex-col min-w-0">
        <Header
          className="px-6 h-16 flex items-center justify-between z-50 shrink-0"
          style={{
            backgroundColor: 'var(--color-content-bg)',
            borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
          }}
        >
          <div className="flex items-center gap-4">
            {/* Global Context Indicator: Active Period (clickable dropdown) */}
            {viewPeriod && (
              <Dropdown
                trigger={['click']}
                menu={{
                  items: visiblePeriods.map(p => ({
                    key: String(p.id),
                    label: (
                      <div className="flex items-center justify-between gap-3 py-0.5">
                        <span className="font-medium text-sm">{p.name}</span>
                        {p.status === 'activo'
                          ? <Tag color="green" className="ml-2 border-none rounded-full text-[10px] font-bold">Activo</Tag>
                          : <Tag color="default" className="ml-2 border-none rounded-full text-[10px] font-bold">Histórico</Tag>}
                      </div>
                    ),
                    onClick: () => setViewPeriod(p),
                  })),
                }}
              >
                <div
                  className="ml-2 hidden md:flex items-center gap-3 cursor-pointer rounded-xl px-3 py-1.5 transition-all hover:bg-slate-50"
                  title="Cambiar período de visualización"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor: isReadOnly
                        ? 'rgba(245,158,11,0.1)'
                        : 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
                    }}
                  >
                    {isReadOnly
                      ? <HistoryOutlined className="text-base" style={{ color: '#f59e0b' }} />
                      : <CalendarOutlined className="text-base" style={{ color: 'var(--color-accent)' }} />}
                  </div>
                  <div className="flex flex-col">
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.18em] leading-none mb-1"
                      style={{ color: isReadOnly ? '#f59e0b' : 'var(--color-text-muted)' }}
                    >
                      {isReadOnly ? 'Modo Solo Lectura' : 'Periodo Activo'}
                    </span>
                    <span
                      className="text-sm font-bold leading-tight"
                      style={{ color: 'var(--color-text-main)' }}
                    >
                      {viewPeriod.name}
                    </span>
                  </div>
                  {isReadOnly
                    ? <LockOutlined style={{ color: '#f59e0b', fontSize: 12 }} />
                    : <Badge status="processing" className="ml-1" />}
                </div>
              </Dropdown>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Button
              danger
              type="primary"
              ghost
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              className="rounded-lg font-semibold"
            >
              Cerrar Sesión
            </Button>
          </div>
        </Header>

        {/* Read-only banner */}
        {isReadOnly && viewPeriod && (
          <div
            className="flex items-center justify-between px-6 py-2.5 shrink-0"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
            }}
          >
            <div className="flex items-center gap-3">
              <EyeOutlined style={{ color: '#f59e0b', fontSize: 16 }} />
              <span className="text-sm font-semibold" style={{ color: '#92400e' }}>
                Modo solo lectura — Viendo período histórico: <strong>{viewPeriod.name}</strong>. Los cambios no se guardarán.
              </span>
            </div>
            <Button
              size="small"
              type="primary"
              onClick={resetViewPeriod}
              className="rounded-lg font-semibold"
              style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}
            >
              Volver al período activo
            </Button>
          </div>
        )}

        <Content className="flex-1 min-w-0 overflow-hidden theme-page-bg relative">
          <div className="absolute inset-0 min-w-0 overflow-x-hidden overflow-y-auto">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
