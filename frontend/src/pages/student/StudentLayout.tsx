import React from 'react';
import { Outlet } from 'react-router-dom';

const StudentLayout: React.FC = () => {
  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <Outlet />
      </div>
    </div>
  );
};

export default StudentLayout;
