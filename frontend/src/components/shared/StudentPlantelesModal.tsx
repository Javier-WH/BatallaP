import React, { useState } from 'react';
import { Modal, Button, Space, Typography, Select } from 'antd';
import { BankOutlined } from '@ant-design/icons';
import PlantelAsyncSelect from './PlantelAsyncSelect';
import type { GradeType } from '@/services/finalGradeEditService';

const { Text } = Typography;
const { Option } = Select;

interface SubjectPlanteles {
  subjectKey: string;
  subjectName: string;
  plantelId?: number | null;
  plantelCode?: string;
  plantelName?: string;
  gradeType?: GradeType | null;
}

interface StudentPlantelesModalProps {
  open: boolean;
  studentName: string;
  subjects: SubjectPlanteles[];
  onClose: () => void;
  onSave: (updates: { subjectKey: string; plantelId: number | null; gradeType: GradeType | null }[]) => void;
}

const StudentPlantelesModal: React.FC<StudentPlantelesModalProps> = ({
  open,
  studentName,
  subjects,
  onClose,
  onSave
}) => {
  const [selectedPlantelId, setSelectedPlantelId] = useState<number | null>(null);
  const [selectedPlantelCode, setSelectedPlantelCode] = useState<string>('');
  const [selectedGradeType, setSelectedGradeType] = useState<GradeType | null>(null);

  // Initialize with current values from first subject if available
  React.useEffect(() => {
    if (open && subjects.length > 0) {
      const firstSubject = subjects[0];
      setSelectedPlantelId(firstSubject.plantelId || null);
      setSelectedPlantelCode(firstSubject.plantelCode || '');
      setSelectedGradeType(firstSubject.gradeType || null);
    }
  }, [open, subjects]);

  const handleSave = () => {
    const updates = subjects.map(s => ({
      subjectKey: s.subjectKey,
      plantelId: selectedPlantelId,
      gradeType: selectedGradeType
    }));
    onSave(updates);
  };

  const handlePlantelChange = (plantelId: number | null, plantel?: { code: string; name: string }) => {
    setSelectedPlantelId(plantelId);
    setSelectedPlantelCode(plantel?.code || '');
  };

  return (
    <Modal
      title={
        <Space>
          <BankOutlined />
          <span>Configurar Fila - {studentName}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="primary" onClick={handleSave}>
            Aplicar a todas las materias
          </Button>
        </Space>
      }
      width={500}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ backgroundColor: '#f0f7ff', padding: '12px', borderRadius: '8px' }}>
          <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>Estudiante:</Text>
          <div style={{ fontWeight: 500, color: '#1890ff', fontSize: '14px' }}>{studentName}</div>
        </div>

        <div>
          <Text strong style={{ display: 'block', marginBottom: '8px' }}>Plantel de Procedencia</Text>
          <PlantelAsyncSelect
            value={selectedPlantelId}
            currentLabel={selectedPlantelCode}
            onChange={handlePlantelChange}
            style={{ width: '100%' }}
            placeholder="Seleccionar plantel..."
          />
        </div>

        <div>
          <Text strong style={{ display: 'block', marginBottom: '8px' }}>Tipo de Nota</Text>
          <Select
            value={selectedGradeType}
            onChange={setSelectedGradeType}
            placeholder="Seleccionar tipo..."
            style={{ width: '100%' }}
            allowClear
          >
            <Option value="regular">Regular</Option>
            <Option value="repitiente">Repitiente</Option>
            <Option value="revisión">Revisión</Option>
            <Option value="equivalencia">Equivalencia</Option>
          </Select>
        </div>

        <div style={{ backgroundColor: '#fffbe6', padding: '12px', borderRadius: '8px', border: '1px solid #ffe58f' }}>
          <Text style={{ fontSize: '12px', color: '#d48806' }}>
            Esta configuración se aplicará a todas las materias del estudiante ({subjects.length} materias)
          </Text>
        </div>
      </div>
    </Modal>
  );
};

export default StudentPlantelesModal;
