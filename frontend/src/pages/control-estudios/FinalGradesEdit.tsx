import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Select, Form, InputNumber, Input, Modal, message, Space, Tag, Typography, Row, Col, Alert, Spin } from 'antd';
import {
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  LockOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import api from '@/services/api';
import finalGradeEditService, { type FinalGrade } from '@/services/finalGradeEditService';
import { gradeEditPermissionService } from '@/services/gradeEditPermissionService';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface SchoolPeriod {
  id: number;
  name: string;
  period: string;
  isActive: boolean;
}

interface PermissionInfo {
  hasPermission: boolean;
  reason?: string;
  permission?: { id: number };
}

const FinalGradesEdit: React.FC = () => {
  const [schoolPeriods, setSchoolPeriods] = useState<SchoolPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [finalGrades, setFinalGrades] = useState<FinalGrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionInfo, setPermissionInfo] = useState<PermissionInfo | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<FinalGrade | null>(null);
  const [editForm] = Form.useForm();

  useEffect(() => {
    fetchSchoolPeriods();
  }, []);

  const fetchSchoolPeriods = async () => {
    try {
      setLoading(true);
      const response = await api.get('/academic/periods');
      // Show all periods (both active and inactive)
      setSchoolPeriods(response.data);
    } catch {
      message.error('Error al cargar períodos escolares');
    } finally {
      setLoading(false);
    }
  };

  const checkPermissionForPeriod = async (periodId: number) => {
    try {
      const response = await gradeEditPermissionService.checkPermission(periodId);
      setHasPermission(response.hasPermission);
      setPermissionInfo(response);
      return response.hasPermission;
    } catch (err: unknown) {
      const error = err as { response?: { status: number } };
      if (error.response?.status === 403) {
        setHasPermission(false);
        setPermissionInfo({ hasPermission: false, reason: 'No tiene permiso para este período' });
        return false;
      }
      console.error('Error checking permission:', err);
      return false;
    }
  };

  const handlePeriodChange = async (periodId: number) => {
    setSelectedPeriod(periodId);
    setFinalGrades([]);
    setHasPermission(false);
    setPermissionInfo(null);

    if (!periodId) return;

    setLoadingGrades(true);

    // Check permission first
    const hasPerm = await checkPermissionForPeriod(periodId);

    if (!hasPerm) {
      message.warning('No tiene permiso para modificar notas de este período');
      setLoadingGrades(false);
      return;
    }

    try {
      const grades = await finalGradeEditService.getFinalGradesByPeriod(periodId);
      setFinalGrades(grades);
    } catch (err: unknown) {
      const error = err as { response?: { status: number } };
      if (error.response?.status === 403) {
        message.error('No tiene permiso para ver notas de este período');
      } else {
        message.error('Error al cargar notas finales');
      }
    } finally {
      setLoadingGrades(false);
    }
  };

  const handleEditGrade = (grade: FinalGrade) => {
    setSelectedGrade(grade);
    setShowEditModal(true);
  };

  // Set form values when modal opens and grade is selected
  useEffect(() => {
    if (showEditModal && selectedGrade) {
      editForm.setFieldsValue({
        finalScore: selectedGrade.finalScore,
        status: selectedGrade.status
      });
    }
  }, [showEditModal, selectedGrade, editForm]);

  const handleSaveGrade = async (values: {
    finalScore: number;
    status: 'aprobada' | 'reprobada';
    reason: string;
  }) => {
    if (!selectedGrade || !permissionInfo) {
      message.error('No se puede guardar: información faltante');
      return;
    }

    try {
      setLoading(true);
      const permId = permissionInfo.permission?.id || (permissionInfo as { id?: number }).id;
      if (!permId) {
        message.error('No se puede guardar: ID de permiso no encontrado');
        return;
      }

      const gradeId = selectedGrade.id ? String(selectedGrade.id) : `new-${selectedGrade.inscriptionSubjectId}`;
      console.log('[handleSaveGrade] Sending update request:', { gradeId, finalScore: values.finalScore, status: values.status, permissionId: permId, inscriptionSubjectId: selectedGrade.inscriptionSubjectId });

      await finalGradeEditService.updateFinalGrade(gradeId, {
        finalScore: values.finalScore,
        status: values.status,
        reason: values.reason,
        permissionId: permId,
        inscriptionSubjectId: selectedGrade.inscriptionSubjectId
      });

      console.log('[handleSaveGrade] Update successful');
      message.success(selectedGrade.id ? 'Nota final actualizada correctamente' : 'Nota final creada correctamente');
      setShowEditModal(false);
      editForm.resetFields();

      // Reload grades
      if (selectedPeriod) {
        console.log('[handleSaveGrade] Reloading grades for period:', selectedPeriod);
        const grades = await finalGradeEditService.getFinalGradesByPeriod(selectedPeriod);
        console.log('[handleSaveGrade] Reloaded grades:', grades.length);
        console.log('[handleSaveGrade] First grade in reloaded data:', grades[0]);
        console.log('[handleSaveGrade] Looking for updated grade with inscriptionSubjectId:', selectedGrade.inscriptionSubjectId);
        const updatedGrade = grades.find(g => g.inscriptionSubjectId === selectedGrade.inscriptionSubjectId);
        console.log('[handleSaveGrade] Updated grade found:', updatedGrade ? updatedGrade.finalScore : 'not found');
        setFinalGrades(grades);
      }
    } catch (err: unknown) {
      console.error('[handleSaveGrade] Error:', err);
      const error = err as { response?: { data?: { message?: string } } };
      message.error(error.response?.data?.message || 'Error al actualizar nota final');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Estudiante',
      key: 'student',
      width: 200,
      render: (_: unknown, record: FinalGrade) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {record.inscriptionSubject?.inscription?.student?.firstName} {record.inscriptionSubject?.inscription?.student?.lastName}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.inscriptionSubject?.inscription?.student?.document}
          </Text>
        </div>
      )
    },
    {
      title: 'Grado',
      dataIndex: ['inscriptionSubject', 'inscription', 'grade', 'name'],
      key: 'grade',
      width: 100
    },
    {
      title: 'Sección',
      dataIndex: ['inscriptionSubject', 'inscription', 'section', 'name'],
      key: 'section',
      width: 80
    },
    {
      title: 'Materia',
      dataIndex: ['inscriptionSubject', 'subject', 'name'],
      key: 'subject',
      width: 200
    },
    {
      title: 'Nota Final',
      dataIndex: 'finalScore',
      key: 'finalScore',
      width: 100,
      render: (score: number | null) => {
        const numScore = Number(score);
        const validScore = isNaN(numScore) ? 0 : numScore;
        return (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: validScore >= 10 ? '#52c41a' : '#ff4d4f' }}>
              {validScore.toFixed(2)}
            </div>
          </div>
        );
      }
    },
    {
      title: 'Estado',
      key: 'status',
      width: 100,
      dataIndex: 'status',
      render: (status: string) => (
        <Tag color={status === 'aprobada' ? 'success' : 'error'} style={{ fontWeight: 600 }}>
          {status === 'aprobada' ? 'Aprobada' : 'Reprobada'}
        </Tag>
      )
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: FinalGrade) => (
        <Button
          type="primary"
          size="small"
          icon={<EditOutlined />}
          onClick={() => handleEditGrade(record)}
          disabled={!hasPermission}
        >
          Editar
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <Space>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <LockOutlined style={{ fontSize: 24, color: '#fff' }} />
            </div>
            <div>
              <Title level={3} style={{ margin: 0 }}>Edición de Notas Finales</Title>
              <Text type="secondary">Modificación de notas de períodos anteriores</Text>
            </div>
          </Space>
        </Col>
        <Col>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchSchoolPeriods}
          >
            Recargar
          </Button>
        </Col>
      </Row>

      {!hasPermission && selectedPeriod && permissionInfo && (
        <Alert
          message="Sin Permisos"
          description={permissionInfo.reason || 'No tiene permiso para modificar notas de este período'}
          type="warning"
          icon={<WarningOutlined />}
          showIcon
          closable
          style={{ marginBottom: '24px' }}
        />
      )}

      {hasPermission && selectedPeriod && (
        <Alert
          message="Permisos Activos"
          description="Tiene permiso para modificar notas de este período. Todas las modificaciones quedarán registradas en el historial de auditoría."
          type="success"
          icon={<CheckCircleOutlined />}
          showIcon
          closable
          style={{ marginBottom: '24px' }}
        />
      )}

      <Card>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Período Escolar
              </Text>
              <Select
                style={{ width: '100%' }}
                placeholder="Seleccione período escolar"
                value={selectedPeriod}
                onChange={handlePeriodChange}
                loading={loading}
                size="large"
              >
                {schoolPeriods.map((period) => (
                  <Option key={period.id} value={period.id}>
                    {period.name} ({period.period})
                  </Option>
                ))}
              </Select>
            </div>
          </Col>
        </Row>

        {selectedPeriod && (
          <div style={{ marginTop: '24px' }}>
            {loadingGrades ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spin size="large" />
              </div>
            ) : finalGrades.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <WarningOutlined style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }} />
                <Title level={4} style={{ marginBottom: 8 }}>No hay notas finales registradas</Title>
                <Text type="secondary">
                  No se encontraron notas finales para el período seleccionado. Es posible que las notas no hayan sido calculadas aún.
                </Text>
              </div>
            ) : (
              <Table
                key={`grades-table-${finalGrades.length}-${finalGrades.map(g => `${g.inscriptionSubjectId}-${g.finalScore}`).join('-')}`}
                columns={columns}
                dataSource={finalGrades}
                rowKey={(record) => record.id || `new-${record.inscriptionSubjectId}`}
                loading={loadingGrades}
                pagination={{ pageSize: 20 }}
                scroll={{ x: 1200 }}
                size="middle"
              />
            )}
          </div>
        )}
      </Card>

      <Modal
        title="Editar Nota Final"
        open={showEditModal}
        onCancel={() => {
          setShowEditModal(false);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        {selectedGrade && (
          <div>
            <div style={{ marginBottom: '16px', padding: '12px', background: '#f5f5f5', borderRadius: 8 }}>
              <Text strong>Estudiante:</Text>{' '}
              {selectedGrade.inscriptionSubject?.inscription?.student?.firstName} {selectedGrade.inscriptionSubject?.inscription?.student?.lastName}
              <br />
              <Text strong>Materia:</Text>{' '}
              {selectedGrade.inscriptionSubject?.subject?.name}
              <br />
              <Text strong>Nota actual:</Text>{' '}
              <Tag color={selectedGrade.status === 'aprobada' ? 'success' : 'error'}>
                {selectedGrade.finalScore !== null ? Number(selectedGrade.finalScore).toFixed(2) : 'N/A'} - {selectedGrade.status === 'aprobada' ? 'Aprobada' : 'Reprobada'}
              </Tag>
            </div>

            <Form
              form={editForm}
              layout="vertical"
              onFinish={handleSaveGrade}
            >
              <Form.Item
                name="finalScore"
                label="Nueva Nota Final"
                rules={[
                  { required: true, message: 'Ingrese la nota final' },
                  { type: 'number', min: 0, max: 20, message: 'La nota debe estar entre 0 y 20' }
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={20}
                  step={0.01}
                  precision={2}
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="status"
                label="Estado"
                rules={[{ required: true, message: 'Seleccione el estado' }]}
              >
                <Select size="large">
                  <Option value="aprobada">Aprobada</Option>
                  <Option value="reprobada">Reprobada</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="reason"
                label="Razón de la Modificación"
                rules={[{ required: true, message: 'Ingrese la razón de la modificación' }]}
              >
                <TextArea
                  rows={4}
                  placeholder="Describa detalladamente el motivo de esta modificación..."
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => setShowEditModal(false)} icon={<CloseOutlined />}>
                    Cancelar
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={loading}
                  >
                    Guardar Cambio
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FinalGradesEdit;
