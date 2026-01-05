import React from 'react';
import { Card } from 'antd';
import StudentAcademicRecord from '@/components/shared/StudentAcademicRecord';

const AdminDashboard: React.FC = () => {
  return (
    <div className="space-y-8">
      <Card className="rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/60">
        <StudentAcademicRecord mode="admin" />
      </Card>
    </div>
  );
};

export default AdminDashboard;
