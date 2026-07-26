import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import Login from '@/pages/Login';
import MainLayout from '@/pages/MainLayout';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SchoolProvider, useSchool } from '@/context/SchoolContext';
import { GradeRoundingProvider } from '@/context/GradeRoundingContext';
import '@/index.css';

// Shared Components
import SearchUsers from '@/pages/shared/SearchUsers';
import EditUser from '@/pages/shared/EditUser';

// Master Module Imports
import MasterLayout from '@/pages/master/MasterLayout';
import MasterDashboard from '@/pages/master/Dashboard';
import RegisterUser from '@/pages/master/RegisterUser';
import AcademicManagement from '@/pages/master/AcademicManagement';

// Admin Module Imports
import AdminLayout from '@/pages/admin/AdminLayout';
import RegisterStaff from '@/pages/admin/RegisterStaff';
import EnrollStudent from '@/pages/admin/EnrollStudent';
import GradeEditPermissions from '@/pages/admin/GradeEditPermissions';


import TeacherProjection from '@/pages/control-estudios/TeacherProjection';
import SchoolManagement from '@/pages/admin/SchoolManagement';
import EnrollmentQuestions from '@/pages/admin/EnrollmentQuestions';
import TeacherPanel from '@/pages/teacher/TeacherPanel';
import RepairGradesPanel from '@/pages/teacher/RepairGradesPanel';
import AdminDashboard from '@/pages/admin/Dashboard';
import StudentDetail from '@/pages/student/StudentDetail';
import SettingsManagement from '@/pages/master/SettingsManagement';
import GeneralDashboard from '@/pages/GeneralDashboard';
import type { JSX } from 'react';
import NotFound from '@/pages/NotFound';

// Control de Estudios Module Imports
import ControlEstudiosLayout from '@/pages/control-estudios/ControlEstudiosLayout';
import ControlEstudiosDashboard from '@/pages/control-estudios/Dashboard';
import AcademicSettings from '@/pages/control-estudios/AcademicSettings';
import MatriculationEnrollment from '@/pages/control-estudios/MatriculationEnrollment';
import CourseCouncil from '@/pages/control-estudios/CourseCouncil';
import FinalGradesEdit from '@/pages/control-estudios/FinalGradesEdit';
import ManageGrades from '@/pages/control-estudios/ManageGrades';
import PerformanceSummary from '@/pages/control-estudios/PerformanceSummary';
import RepairPeriodManagement from '@/pages/control-estudios/RepairPeriodManagement';
import RegisterRepresentative from '@/pages/admin/RegisterRepresentative';


import RepresentativeLayout from '@/pages/representative/RepresentativeLayout';
import MyStudents from '@/pages/representative/MyStudents';

// Student Module Imports
import StudentLayout from '@/pages/student/StudentLayout';
import MyDossier from '@/pages/student/MyDossier';

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

// Theme wrapper that applies Ant Design ConfigProvider with dynamic colors
const ThemeWrapper = ({ children }: { children: React.ReactNode }) => {
  const { settings } = useSchool();

  const primary = settings.themePrimaryColor || '#1e40af';
  const accent = settings.themeAccentColor || primary;
  const contentBg = settings.themeContentBg || '#ffffff';
  const inputBg = settings.themeInputBg || '#ffffff';
  const textMain = settings.themeTextColor || '#0f172a';
  const inactive = settings.themeSecondaryColor || '#e2e8f0';
  const headerText = settings.themeHeaderText || '#ffffff';

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: primary,
          colorInfo: settings.themeBrandSecondary || '#0ea5e9',
          colorTextBase: textMain,
          colorBgLayout: settings.themePageBg || '#f8fafc',
          colorBgContainer: contentBg,
          colorBorder: 'rgba(15, 23, 42, 0.08)',
          colorBorderSecondary: 'rgba(15, 23, 42, 0.06)',
          borderRadius: 12,
          borderRadiusLG: 16,
          fontFamily: 'Inter, system-ui, sans-serif',
        },
        components: {
          Layout: {
            headerBg: contentBg,
            siderBg: settings.themeSidebarColor || '#0f172a',
            bodyBg: settings.themePageBg || '#f8fafc',
          },
          Checkbox: {
            colorPrimary: accent,
            colorPrimaryHover: accent,
          },
          Radio: {
            colorPrimary: accent,
            buttonBg: inactive,
            buttonCheckedBg: accent,
            buttonColor: textMain,
            colorText: textMain,
          },
          Segmented: {
            itemSelectedBg: accent,
            itemSelectedColor: headerText,
            trackBg: inactive,
            itemColor: textMain,
          },
          DatePicker: { colorBgContainer: inputBg },
          Input: { colorBgContainer: inputBg },
          InputNumber: { colorBgContainer: inputBg },
          Select: { colorBgContainer: inputBg },
          Table: {
            colorBgContainer: contentBg,
            headerBg: 'color-mix(in srgb, ' + textMain + ' 4%, ' + contentBg + ')',
            headerColor: textMain,
            rowHoverBg: 'color-mix(in srgb, ' + accent + ' 6%, transparent)',
            borderColor: 'rgba(15, 23, 42, 0.06)',
            headerSplitColor: 'rgba(15, 23, 42, 0.06)',
          },
          Card: {
            colorBgContainer: contentBg,
            colorBorderSecondary: 'rgba(15, 23, 42, 0.08)',
          },
          Modal: {
            contentBg: contentBg,
            headerBg: contentBg,
          },
          Menu: {
            itemBg: 'transparent',
            subMenuItemBg: 'transparent',
          },
          Pagination: {
            colorPrimary: primary,
            colorPrimaryHover: accent,
          },
          Empty: {},
          Tag: {
            defaultBg: 'color-mix(in srgb, ' + textMain + ' 4%, ' + contentBg + ')',
          },
        }
      }}
    >
      {children}
    </ConfigProvider>
  );
};


function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />

      {/* General Dashboard (To be defined or shared) */}
      <Route path="/" element={<RequireAuth><MainLayout /></RequireAuth>}>
        <Route path="dashboard" element={<GeneralDashboard />} />

        {/* Nested Master Module */}
        <Route path="master" element={<RequireAuth allowedRoles={['Master']}><MasterLayout /></RequireAuth>}>
          <Route index element={<MasterDashboard />} />
          <Route path="register" element={<RegisterUser />} />
          <Route path="directorio" element={<SearchUsers />} />
          <Route path="edit/:id" element={<EditUser />} />
          <Route path="settings" element={<SettingsManagement />} />
        </Route>

        {/* Nested Admin Module */}
        <Route path="admin" element={<RequireAuth allowedRoles={['Administrador', 'Master']}><AdminLayout /></RequireAuth>}>
          <Route index element={<AdminDashboard />} />
          <Route path="register-staff" element={<RegisterStaff />} />
          <Route path="inscribir-estudiante" element={<EnrollStudent />} />
          <Route path="matricular-estudiante" element={<MatriculationEnrollment />} />
          <Route path="registrar-representante" element={<RegisterRepresentative />} />
          <Route path="directorio" element={<SearchUsers />} />
          <Route path="projection" element={<TeacherProjection />} />
          <Route path="planteles" element={<SchoolManagement />} />
          <Route path="enrollment-questions" element={<EnrollmentQuestions />} />
          <Route path="search" element={<SearchUsers />} />
          <Route path="edit/:id" element={<EditUser />} />
          <Route path="permisos-edicion-notas" element={<GradeEditPermissions />} />
        </Route>

        {/* Nested Control de Estudios Module */}
        <Route
          path="control-estudios"
          element={
            <RequireAuth allowedRoles={['Control de Estudios', 'Administrador', 'Master']}>
              <ControlEstudiosLayout />
            </RequireAuth>
          }
        >
          <Route index element={<ControlEstudiosDashboard />} />
          <Route path="matricular-estudiante" element={<MatriculationEnrollment />} />
          <Route path="configuracion" element={<AcademicSettings />} />
          <Route path="academic" element={<AcademicManagement />} />
          <Route path="consejos-curso" element={<CourseCouncil />} />
          <Route path="proyeccion" element={<TeacherProjection />} />
          <Route path="editar-notas" element={<FinalGradesEdit />} />
          <Route path="calificaciones" element={<ManageGrades />} />
          <Route path="resumen-rendimiento" element={<PerformanceSummary />} />
          <Route path="reparacion" element={<RepairPeriodManagement />} />
          <Route path="edit/:id" element={<EditUser />} />
          <Route path="search" element={<SearchUsers />} />
        </Route>


        <Route
          path="gestion-usuarios"
          element={
            <RequireAuth allowedRoles={['Master', 'Administrador']}>
              <SearchUsers />
            </RequireAuth>
          }
        />


        {/* Teacher Module (Spanish) */}
        <Route path="profesor" element={<RequireAuth allowedRoles={['Profesor']}><TeacherPanel /></RequireAuth>}>
          <Route index element={<h1>Panel del Profesor</h1>} />
        </Route>
        <Route path="profesor/reparacion" element={<RequireAuth allowedRoles={['Profesor']}><RepairGradesPanel /></RequireAuth>} />

        {/* Representative Module */}
        <Route path="representante" element={<RequireAuth allowedRoles={['Representante']}><RepresentativeLayout /></RequireAuth>}>
          <Route index element={<MyStudents />} />
        </Route>

        {/* Student Module */}
        <Route path="estudiante" element={<RequireAuth allowedRoles={['Alumno']}><StudentLayout /></RequireAuth>}>
          <Route index element={<MyDossier />} />
        </Route>

        {/* Academic Record Module */}
        <Route
          path="student/:personId"
          element={
            <RequireAuth allowedRoles={['Administrador', 'Master', 'Control de Estudios', 'Representante', 'Alumno']}>
              <StudentDetail />
            </RequireAuth>
          }
        />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <SchoolProvider>
        <ThemeWrapper>
          <AuthProvider>
            <GradeRoundingProvider>
              <AppRoutes />
            </GradeRoundingProvider>
          </AuthProvider>
        </ThemeWrapper>
      </SchoolProvider>
    </Router>
  );
}

export default App;

