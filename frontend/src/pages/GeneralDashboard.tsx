import React, { useState } from 'react';
import { Button } from 'antd';
import { EditOutlined, CloseOutlined } from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import DashboardContent from '@/components/DashboardContent';
import DashboardEditorManual from '@/pages/shared/DashboardEditorManual';

const GeneralDashboard: React.FC = () => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [dashboardReloadKey, setDashboardReloadKey] = useState(0);

  // Check if user has permission to edit (Master or Admin)
  const canEdit = user?.roles.some(role => role === 'Master' || role === 'Administrador');

  const handleSaved = () => {
    setIsEditing(false);
    setDashboardReloadKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard General</h1>
          <p className="text-slate-500 mt-1">Bienvenido al sistema de gestión educativa</p>
        </div>
        {canEdit && (
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => setIsEditing(true)}
            size="large"
            className="rounded-2xl"
          >
            Editar Dashboard
          </Button>
        )}
      </div>

      {isEditing ? (
        <div>
          <div className="flex justify-end mb-4">
            <Button
              icon={<CloseOutlined />}
              onClick={() => setIsEditing(false)}
            >
              Cancelar
            </Button>
          </div>
          <DashboardEditorManual key={isEditing ? 'editor-open' : 'editor-closed'} onSaved={handleSaved} />
        </div>
      ) : (
        <DashboardContent reloadKey={dashboardReloadKey} />
      )}
    </div>
  );
};

export default GeneralDashboard;
