import React, { useMemo, useState } from 'react';
import { Button, Tabs } from 'antd';
import { CheckSquareOutlined, TeamOutlined, AppstoreOutlined, UserOutlined, DownloadOutlined } from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import TeacherAttendanceTab from './TeacherAttendanceTab';
import StaffSessionsTab from './StaffSessionsTab';
import SectionReportTab from './SectionReportTab';
import StudentReportTab from './StudentReportTab';
import { isRunningStandalone } from '@/utils/pwaInstall';

const STAFF_ROLES = ['Master', 'Administrador', 'Control de Estudios'];

/**
 * This module lives inside the main app, whose manifest installs the whole system. The
 * attendance-only app installs from its own page, so teachers get a shortcut to it
 * (hidden once they are already running an installed app).
 */
const InstallAttendanceAppLink: React.FC = () => {
  if (isRunningStandalone()) return null;
  return (
    <div className="flex justify-end px-1 pt-1">
      <Button
        size="small"
        icon={<DownloadOutlined />}
        title="Abre la app independiente de asistencias, desde donde se puede instalar sola"
        onClick={() => window.location.assign('/asistencias.html')}
      >
        Instalar app de asistencias
      </Button>
    </div>
  );
};

/**
 * Attendance module: horizontal tabs per role.
 * - Profesor: mark attendance for their scheduled sessions (with backfill).
 * - Control de Estudios / Administrador / Master: sessions, reports by
 *   section and by student (view, export; edit only exceptionally).
 *
 * A pure teacher has a single view, so it renders without the page title and
 * tab bar — the phone frame gains that vertical space. When the teacher view
 * lives inside the tabs (staff), the frame's back arrow exits to Sesiones.
 */
const AttendanceModule: React.FC = () => {
  const { user } = useAuth();
  const [activeKey, setActiveKey] = useState<string>();

  const roles = useMemo(() => user?.roles ?? [], [user]);
  const isTeacher = roles.includes('Profesor');
  const isStaff = roles.some(r => STAFF_ROLES.includes(r));

  const items = useMemo(() => {
    const tabs = [];
    if (isTeacher) {
      tabs.push({
        key: 'teacher',
        label: <span><CheckSquareOutlined /> Tomar Asistencia</span>,
        children: (
          <>
            <InstallAttendanceAppLink />
            <TeacherAttendanceTab onExit={() => setActiveKey('sessions')} />
          </>
        ),
      });
    }
    if (isStaff) {
      tabs.push(
        {
          key: 'sessions',
          label: <span><TeamOutlined /> Sesiones</span>,
          children: <StaffSessionsTab />,
        },
        {
          key: 'by-section',
          label: <span><AppstoreOutlined /> Por Sección</span>,
          children: <SectionReportTab />,
        },
        {
          key: 'by-student',
          label: <span><UserOutlined /> Por Estudiante</span>,
          children: <StudentReportTab />,
        },
      );
    }
    return tabs;
  }, [isTeacher, isStaff]);

  // Single-view users (teachers without staff roles) skip the redundant
  // "Asistencias" heading and the one-item tab bar.
  if (items.length === 1) {
    return (
      <div className="h-full min-h-0 overflow-y-auto px-3 py-3 sm:px-6 sm:py-4">
        {items[0].children}
      </div>
    );
  }

  return (
    <div className="p-6 h-full min-h-0 overflow-y-auto">
      <div className="mb-4">
        <h1 className="text-xl font-black text-slate-800">Asistencias</h1>
        <p className="text-xs text-slate-500">
          Control de asistencia por sesión de clase, con registro auditable de bloqueos y desbloqueos.
        </p>
      </div>
      <Tabs
        activeKey={activeKey ?? items[0]?.key}
        onChange={setActiveKey}
        items={items}
        size="large"
      />
    </div>
  );
};

export default AttendanceModule;
