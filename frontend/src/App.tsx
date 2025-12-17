import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from '@/pages/Login';
import MainLayout from '@/pages/MainLayout';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import '@/index.css';

// Master Module Imports
import MasterLayout from '@/pages/master/MasterLayout';
import MasterDashboard from '@/pages/master/Dashboard';
import RegisterUser from '@/pages/master/RegisterUser';
import SearchUsers from '@/pages/master/SearchUsers';
import EditUser from '@/pages/master/EditUser';
import AcademicManagement from '@/pages/master/AcademicManagement';

// Admin Module Imports
import AdminLayout from '@/pages/admin/AdminLayout';
import RegisterSpecialized from '@/pages/admin/RegisterSpecialized';
import SearchUsersAdmin from '@/pages/admin/SearchUsersAdmin';
import EditUserAdmin from '@/pages/admin/EditUserAdmin';
import type { JSX } from 'react';

// Protected Route Component
const RequireAuth = ({ children, allowedRoles }: { children: JSX.Element; allowedRoles?: string[] }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // Or a Spin component
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Check role permission if defined
  if (allowedRoles) {
    // Check if user has AT LEAST ONE of the allowed roles
    const hasPermission = user.roles.some(role => allowedRoles.includes(role));
    if (!hasPermission) {
      return <Navigate to="/dashboard" replace />; // Redirect to common dashboard or access denied page
    }
  }

  return children;
};

// Public Route (redirects to dashboard if already logged in)
const PublicRoute = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (user) {
    // Redirect based on primary role? For now generic dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}


function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />

      {/* General Dashboard (To be defined or shared) */}
      <Route path="/" element={<RequireAuth><MainLayout /></RequireAuth>}>
        <Route path="dashboard" element={<h1>Bienvenido al Dashboard General</h1>} />

        {/* Nested Master Module */}
        <Route path="master" element={<RequireAuth allowedRoles={['Master']}><MasterLayout /></RequireAuth>}>
          <Route index element={<MasterDashboard />} />
          <Route path="register" element={<RegisterUser />} />
          <Route path="search" element={<SearchUsers />} />
          <Route path="edit/:id" element={<EditUser />} />
          <Route path="academic" element={<AcademicManagement />} />
        </Route>

        {/* Nested Admin Module */}
        <Route path="admin" element={<RequireAuth allowedRoles={['Admin']}><AdminLayout /></RequireAuth>}>
          <Route index element={<h1>Panel de Admin</h1>} /> {/* Placeholder dashboard */}
          <Route path="register-teacher" element={<RegisterSpecialized roleTarget="Teacher" title="Profesor" />} />
          <Route path="register-tutor" element={<RegisterSpecialized roleTarget="Tutor" title="Representante" />} />
          <Route path="search" element={<SearchUsersAdmin />} />
          <Route path="edit/:id" element={<EditUserAdmin />} />
        </Route>
      </Route>

      <Route path="*" element={<h1>404 Not Found</h1>} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
