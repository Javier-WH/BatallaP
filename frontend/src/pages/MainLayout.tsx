import React, { useState } from 'react';
import { Layout, Menu, Button, theme } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  DashboardOutlined,
  TeamOutlined,
  BookOutlined,
  FileTextOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  }

  // Define all possible menu items with their order and specific role access
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
      icon: <UserOutlined />,
      label: 'Master',
      roles: ['Master'],
      path: '/master'
    },
    {
      key: 'admin-module',
      icon: <TeamOutlined />,
      label: 'Administrador',
      roles: ['Administrador'],
      path: '/admin'
    },
    {
      key: 'control-estudios-module',
      icon: <FileTextOutlined />,
      label: 'Control de Estudios',
      roles: ['Control de Estudios'],
      path: '/control-estudios'
    },
    {
      key: 'search-users',
      icon: <SearchOutlined />,
      label: 'Buscar / Editar',
      roles: ['Master', 'Administrador'],
      path: '/gestion-usuarios'
    },
    {
      key: 'students',
      icon: <TeamOutlined />,
      label: 'Estudiantes',
      roles: ['Master', 'Administrador', 'Control de Estudios'],
      path: '/estudiantes'
    },
    {
      key: 'profesor-module',
      icon: <BookOutlined />,
      label: 'Profesor',
      roles: ['Profesor'],
      path: '/profesor'
    },
    {
      key: 'representante-module',
      icon: <UserOutlined />,
      label: 'Representante',
      roles: ['Representante'],
      path: '/representante'
    },
    {
      key: 'alumno-module',
      icon: <UserOutlined />,
      label: 'Alumno',
      roles: ['Alumno'],
      path: '/alumno'
    }
  ];

  // Filter menu items to show only the modules the user has access to, in the specified order
  const menuItems = allMenuItems
    .filter(item => {
      // For each menu item, check if user has at least one of the required roles
      return user?.roles.some(userRole => item.roles.includes(userRole));
    })
    .map(({ key, icon, label, path }) => ({
      key,
      icon,
      label,
      onClick: () => navigate(path)
    }));


  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed}>
        <div className="demo-logo-vertical" style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', borderRadius: 6 }} />
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['dashboard']}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer, display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>Hola, <strong>{user?.firstName}</strong> ({user?.roles?.join(', ')})</span>
            <Button icon={<LogoutOutlined />} onClick={handleLogout}>Salir</Button>
          </div>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
