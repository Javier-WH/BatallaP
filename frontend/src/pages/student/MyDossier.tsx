import React from 'react';
import { useAuth } from '@/context/AuthContext';
import StudentDetail from './StudentDetail';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

const MyDossier: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user || !user.personId) {
    return (
      <Result
        status="403"
        title="No se encontró un expediente asociado"
        subTitle="Lo sentimos, tu usuario no tiene un perfil de estudiante vinculado."
        extra={<Button type="primary" onClick={() => navigate('/')}>Volver al Inicio</Button>}
      />
    );
  }

  return <StudentDetail personId={user.personId} />;
};

export default MyDossier;
