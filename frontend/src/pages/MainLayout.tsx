import React, { useState } from 'react';
import { Layout, Menu, Button, theme } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UploadOutlined,
  UserOutlined,
  VideoCameraOutlined,
  LogoutOutlined,
  DashboardOutlined
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

  const menuItems: any[] = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
      onClick: () => navigate('/dashboard')
    }
  ];

  if (user?.roles.includes('Master')) {
    menuItems.push({
      key: 'master-module',
      icon: <UserOutlined />, // You can change this icon
      label: 'Master',
      onClick: () => navigate('/master')
    });
  }

  // Example items for others
  const otherItems = [
    {
      key: '1',
      icon: <UserOutlined />,
      label: 'Alumnos',
    },
    {
      key: '2',
      icon: <VideoCameraOutlined />,
      label: 'Profesores',
    },
    {
      key: '3',
      icon: <UploadOutlined />,
      label: 'Carga de Notas',
    },
  ];

  menuItems.push(...otherItems); // Added back for demonstration

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
