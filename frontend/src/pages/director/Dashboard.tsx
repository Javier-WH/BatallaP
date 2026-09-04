import ControlEstudiosDashboard from '@/pages/control-estudios/Dashboard';

// Director dashboard reuses the Control de Estudios dashboard.
// Director has all Control de Estudios permissions plus its own settings page.
export default function DirectorDashboard() {
  return <ControlEstudiosDashboard />;
}
