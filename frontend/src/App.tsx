import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from '@/pages/Login';
import MainLayout from '@/pages/MainLayout';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import '@/index.css';

// Protected Route Component
const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // Or a Spin component
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Public Route (redirects to dashboard if already logged in)
const PublicRoute = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}


function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />

      <Route path="/" element={<RequireAuth><MainLayout /></RequireAuth>}>
        <Route path="dashboard" element={<h1>Bienvenido al Dashboard</h1>} />
        {/* Add more protected routes here */}
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
