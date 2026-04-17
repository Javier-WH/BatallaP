import React, { useState } from 'react';
import { Modal, Button, Space, Typography, Table } from 'antd';
import { BankOutlined } from '@ant-design/icons';
import PlantelSelectorModal from './PlantelSelectorModal';

const { Text } = Typography;

interface SubjectPlanteles {
  subjectKey: string;
  subjectName: string;
  plantelId?: number | null;
  plantelCode?: string;
  plantelName?: string;
}

interface StudentPlantelesModalProps {
  open: boolean;
  studentName: string;
  subjects: SubjectPlanteles[];
  onClose: () => void;
  onSave: (updates: { subjectKey: string; plantelId: number | null }[]) => void;
}

const StudentPlantelesModal: React.FC<StudentPlantelesModalProps> = ({
  open,
  studentName,
  subjects,
  onClose,
  onSave
}) => {
  const [plantelModalOpen, setPlantelModalOpen] = useState(false);
  const [selectedSubjectKey, setSelectedSubjectKey] = useState<string | null>(null);
  const [localSubjects, setLocalSubjects] = useState<SubjectPlanteles[]>(subjects);

  const handleOpenPlantelSelector = (subjectKey: string) => {
    setSelectedSubjectKey(subjectKey);
    setPlantelModalOpen(true);
  };

  const handlePlantelSelect = (plantel: { id: number; code: string; name: string; state: string }) => {
    if (selectedSubjectKey) {
      setLocalSubjects(prev => prev.map(s => {
        if (s.subjectKey === selectedSubjectKey) {
          return { ...s, plantelId: plantel.id, plantelCode: plantel.code, plantelName: plantel.name };
        }
        return s;
      }));
    }
    setPlantelModalOpen(false);
    setSelectedSubjectKey(null);
  };

  const handleSave = () => {
    const updates = localSubjects.map(s => ({
      subjectKey: s.subjectKey,
      plantelId: s.plantelId || null
    }));
    onSave(updates);
  };

  const columns = [
    {
      title: 'Materia',
      dataIndex: 'subjectName',
      key: 'subjectName',
      width: 200
    },
    {
      title: 'Plantel',
      key: 'plantel',
      render: (_: unknown, record: SubjectPlanteles) => (
        <Space>
          <Text>{record.plantelCode || record.plantelName || 'Sin asignar'}</Text>
          <Button
            size="small"
            icon={<BankOutlined />}
            onClick={() => handleOpenPlantelSelector(record.subjectKey)}
          >
            Cambiar
          </Button>
        </Space>
      )
    }
  ];

  const dataSource = localSubjects.map(s => ({
    key: s.subjectKey,
    subjectName: s.subjectName,
    plantelCode: s.plantelCode,
    plantelName: s.plantelName,
    plantelId: s.plantelId,
    subjectKey: s.subjectKey
  }));

  return (
    <>
      <Modal
        title={
          <Space>
            <BankOutlined />
            <span>Editar Planteles - {studentName}</span>
          </Space>
        }
        open={open}
        onCancel={onClose}
        footer={
          <Space>
            <Button onClick={onClose}>Cancelar</Button>
            <Button type="primary" onClick={handleSave}>
              Guardar Cambios
            </Button>
          </Space>
        }
        width={600}
      >
        <div className="space-y-4">
          <div className="bg-blue-50 p-3 rounded-lg">
            <Text type="secondary" className="text-xs">Estudiante:</Text>
            <div className="font-medium text-blue-900">{studentName}</div>
          </div>

          <Table
            columns={columns}
            dataSource={dataSource}
            pagination={false}
            size="small"
          />
        </div>
      </Modal>

      <PlantelSelectorModal
        open={plantelModalOpen}
        currentPlantelLabel={
          selectedSubjectKey
            ? localSubjects.find(s => s.subjectKey === selectedSubjectKey)?.plantelCode
            : undefined
        }
        onSelect={handlePlantelSelect}
        onClose={() => {
          setPlantelModalOpen(false);
          setSelectedSubjectKey(null);
        }}
      />
    </>
  );
};

export default StudentPlantelesModal;
