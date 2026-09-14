import React, { useMemo } from 'react';
import { Tabs } from 'antd';
import { CheckSquareOutlined, TeamOutlined, SettingOutlined } from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import TeacherAttendanceTab from './TeacherAttendanceTab';
import StaffSessionsTab from './StaffSessionsTab';
import AdminAttendanceTab from './AdminAttendanceTab';

const STAFF_ROLES = ['Master', 'Administrador', 'Control de Estudios'];

/**
 * Attendance module: horizontal tabs per role.
 * - Profesor: mark attendance for their scheduled sessions (with backfill).
 * - Control de Estudios / Administrador / Master: browse and edit all sessions.
 * - Administrador / Master: reports + configuration.
 */
const AttendanceModule: React.FC = () => {
  const { user } = useAuth();

  const roles = useMemo(() => user?.roles ?? [], [user]);
  const isTeacher = roles.includes('Profesor');
  const isStaff = roles.some(r => STAFF_ROLES.includes(r));
  const isAdmin = roles.includes('Administrador') || roles.includes('Master');

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
      tabs.push({
        key: 'sessions',
        label: <span><TeamOutlined /> Sesiones</span>,
        children: <StaffSessionsTab />,
      });
    }
    if (isAdmin) {
      tabs.push({
        key: 'admin',
        label: <span><SettingOutlined /> Administración</span>,
        children: <AdminAttendanceTab />,
      });
    }
    return tabs;
  }, [isTeacher, isStaff, isAdmin]);

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
