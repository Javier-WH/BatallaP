import React, { useMemo } from 'react';
import { Tabs } from 'antd';
import { CheckSquareOutlined, TeamOutlined, AppstoreOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import TeacherAttendanceTab from './TeacherAttendanceTab';
import StaffSessionsTab from './StaffSessionsTab';
import SectionReportTab from './SectionReportTab';
import StudentReportTab from './StudentReportTab';

const STAFF_ROLES = ['Master', 'Administrador', 'Control de Estudios'];

/**
 * Attendance module: horizontal tabs per role.
 * - Profesor: mark attendance for their scheduled sessions (with backfill).
 * - Control de Estudios / Administrador / Master: sessions, reports by
 *   section and by student (view, export; edit only exceptionally).
 */
const AttendanceModule: React.FC = () => {
  const { user } = useAuth();

  const roles = useMemo(() => user?.roles ?? [], [user]);
  const isTeacher = roles.includes('Profesor');
  const isStaff = roles.some(r => STAFF_ROLES.includes(r));

  const items = useMemo(() => {
    const tabs = [];
    if (isTeacher) {
      tabs.push({
        key: 'teacher',
        label: <span><CheckSquareOutlined /> Tomar Asistencia</span>,
        children: <TeacherAttendanceTab />,
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

  return (
    <div className="p-6 h-full min-h-0 overflow-y-auto">
      <div className="mb-4">
        <h1 className="text-xl font-black text-slate-800">Asistencias</h1>
        <p className="text-xs text-slate-500">
          Control de asistencia por sesión de clase, con registro auditable de bloqueos y desbloqueos.
        </p>
      </div>
      <Tabs
        defaultActiveKey={items[0]?.key}
        items={items}
        size="large"
      />
    </div>
  );
};

export default AttendanceModule;
