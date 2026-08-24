import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, Button, Tag, Space, Typography, Row, Col, Spin, message, Modal,
  Empty, Tooltip, Input, Checkbox, Table, InputNumber, Divider, Alert,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ReloadOutlined, UserAddOutlined, UserOutlined, DeleteOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, BookOutlined,
  LockOutlined, EditOutlined, SaveOutlined,
} from '@ant-design/icons';
import api from '@/services/api';
import { compareStudents } from '@/utils/studentSort';

const { Title, Text } = Typography;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
interface Grade {
  id: number;
  name: string;
  isDiversified: boolean;
  order: number;
}

interface MpSubject {
  id: number;
  name: string;
  studentCount: number;
  periodGradeSubjectId: number;
}

interface MpGradeGroup {
  grade: Grade;
  periodGrade: any;
  subjects: MpSubject[];
  mpSection: { id: number; name: string };
}

interface MpStructureResponse {
  period: { id: number; name: string } | null;
  grades: MpGradeGroup[];
}

interface StudentForRegistration {
  inscriptionId: number;
  personId: number;
  studentName: string;
  studentDni: string;
  documentType: string;
  escolaridad: string;
  sectionName: string;
  gradeName: string;
}

interface NominaSubject {
  id: number;
  name: string;
  periodGradeSubjectId: number;
}

interface NominaStudent {
  inscriptionId: number;
  personId: number;
  studentName: string;
  studentDni: string;
  documentType: string;
  subjects: {
    inscriptionSubjectId: number;
    subjectId: number;
    subjectName: string;
    finalGrade: {
      finalScore: number | null;
      status: string;
      gradeType: string;
      calculatedAt: string;
    } | null;
  }[];
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
const PendingSubjectManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [structure, setStructure] = useState<MpStructureResponse | null>(null);
  const [expandedGradeId, setExpandedGradeId] = useState<number | null>(null);
  const [nomina, setNomina] = useState<{ grade: Grade; subjects: NominaSubject[]; students: NominaStudent[] } | null>(null);
  const [nominaLoading, setNominaLoading] = useState(false);

  // Registration modal
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [regModalGrade, setRegModalGrade] = useState<MpGradeGroup | null>(null);
  const [regModalSubject, setRegModalSubject] = useState<MpSubject | null>(null);
  const [regStudents, setRegStudents] = useState<StudentForRegistration[]>([]);
  const [regLoading, setRegLoading] = useState(false);
  const [regSelected, setRegSelected] = useState<Set<number>>(new Set());
  const [regSearch, setRegSearch] = useState('');

  // Grade editing modal
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [gradeModalStudent, setGradeModalStudent] = useState<NominaStudent | null>(null);
  const [gradeModalSubject, setGradeModalSubject] = useState<NominaSubject | null>(null);
  const [gradeValue, setGradeValue] = useState<number | null>(null);
  const [gradeSaving, setGradeSaving] = useState(false);

  /* ------------------- Fetch structure ------------------- */
  const fetchStructure = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<MpStructureResponse>('/pending-subjects/structure');
      setStructure(res.data);
      if (res.data.grades.length > 0 && !expandedGradeId) {
        setExpandedGradeId(res.data.grades[0].grade.id);
      }
    } catch (error: any) {
      console.error('[PendingSubject] Error:', error);
      message.error(error?.response?.data?.message || 'Error al cargar estructura');
    } finally {
      setLoading(false);
    }
  }, [expandedGradeId]);

  /* ------------------- Fetch nomina for a grade ------------------- */
  const fetchNomina = useCallback(async (gradeId: number) => {
    setNominaLoading(true);
    try {
      const res = await api.get(`/pending-subjects/nomina/${gradeId}`);
      setNomina(res.data);
    } catch (error: any) {
      console.error('[PendingSubject] Error nomina:', error);
      message.error(error?.response?.data?.message || 'Error al cargar nómina');
    } finally {
      setNominaLoading(false);
    }
  }, []);

  useEffect(() => { fetchStructure(); }, [fetchStructure]);

  useEffect(() => {
    if (expandedGradeId) fetchNomina(expandedGradeId);
    else setNomina(null);
  }, [expandedGradeId, fetchNomina]);

  /* ------------------- Open registration modal ------------------- */
  const openRegModal = async (group: MpGradeGroup, subject: MpSubject) => {
    setRegModalGrade(group);
    setRegModalSubject(subject);
    setRegModalOpen(true);
    setRegSelected(new Set());
    setRegSearch('');
    setRegLoading(true);
    try {
      const res = await api.get<{ students: StudentForRegistration[] }>(`/pending-subjects/students/${group.grade.id}`);
      setRegStudents(res.data.students || []);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al cargar estudiantes');
    } finally {
      setRegLoading(false);
    }
  };

  /* ------------------- Register students ------------------- */
  const handleRegister = async () => {
    if (!regModalGrade || !regModalSubject || regSelected.size === 0) {
      message.warning('Seleccione al menos un estudiante');
      return;
    }
    setActing(true);
    try {
      const inscriptionIds = Array.from(regSelected);
      await api.post('/pending-subjects/register', {
        gradeId: regModalGrade.grade.id,
        subjectId: regModalSubject.id,
        inscriptionIds,
      });
      message.success(`${inscriptionIds.length} estudiante(s) registrado(s)`);
      setRegModalOpen(false);
      await fetchStructure();
      if (expandedGradeId) await fetchNomina(expandedGradeId);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al registrar');
    } finally {
      setActing(false);
    }
  };

  /* ------------------- Remove student from subject ------------------- */
  const handleRemove = async (inscriptionSubjectId: number, studentName: string) => {
    Modal.confirm({
      title: 'Remover estudiante',
      content: `¿Remover a ${studentName} de esta materia pendiente?`,
      okText: 'Sí, remover',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await api.delete(`/pending-subjects/remove/${inscriptionSubjectId}`);
          message.success('Estudiante removido');
          await fetchStructure();
          if (expandedGradeId) await fetchNomina(expandedGradeId);
        } catch (error: any) {
          message.error(error?.response?.data?.message || 'Error al remover');
        }
      },
    });
  };

  /* ------------------- Save direct final grade ------------------- */
  const handleSaveGrade = async () => {
    if (!gradeModalStudent || !gradeModalSubject || gradeValue == null) return;
    const insSubj = gradeModalStudent.subjects.find(s => s.subjectId === gradeModalSubject.id);
    if (!insSubj) {
      message.error('El estudiante no está registrado en esta materia');
      return;
    }
    setGradeSaving(true);
    try {
      await api.post('/pending-subjects/final-grade', {
        inscriptionSubjectId: insSubj.inscriptionSubjectId,
        finalScore: gradeValue,
      });
      message.success('Nota guardada');
      setGradeModalOpen(false);
      if (expandedGradeId) await fetchNomina(expandedGradeId);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Error al guardar nota');
    } finally {
      setGradeSaving(false);
    }
  };

  /* ------------------- Filtered students for registration ------------------- */
  const filteredRegStudents = useMemo(() => {
    if (!regSearch) return regStudents;
    const q = regSearch.toLowerCase();
    return regStudents.filter(s =>
      s.studentName.toLowerCase().includes(q) ||
      s.studentDni.includes(q) ||
      s.sectionName?.toLowerCase().includes(q)
    );
  }, [regStudents, regSearch]);

  /* ------------------- Registration table columns ------------------- */
  const regColumns: ColumnsType<StudentForRegistration> = [
    {
      title: 'Estudiante',
      key: 'studentName',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.studentName}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {r.documentType === 'Venezolano' ? 'V' : r.documentType === 'Extranjero' ? 'E' : r.documentType === 'Pasaporte' ? 'P' : 'CE'}-{r.studentDni} · {r.sectionName}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Escolaridad',
      key: 'escolaridad',
      width: 140,
      render: (_, r) => (
        <Tag color={r.escolaridad === 'materia_pendiente' ? 'orange' : 'blue'}>
          {r.escolaridad === 'materia_pendiente' ? 'Materia Pendiente' :
           r.escolaridad === 'repitiente' ? 'Repitiente' :
           r.escolaridad === 'regular' ? 'Regular' : r.escolaridad}
        </Tag>
      ),
    },
  ];

  /* ------------------- Render ------------------- */
  if (loading && !structure) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>;
  }

  if (!structure?.period) {
    return (
      <div style={{ padding: 40 }}>
        <Alert type="warning" message="No hay un período escolar activo" showIcon />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Materia Pendiente</Title>
          <Text type="secondary">Período: {structure.period.name}</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchStructure} loading={loading}>Actualizar</Button>
      </div>

      <Alert
        type="info"
        message="Gestión de Materias Pendientes"
        description="Seleccione un año para ver las materias. Las materias deshabilitadas no tienen estudiantes registrados. Use «Registrar Estudiantes» para inscribir estudiantes del año siguiente."
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* Grade selector */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {structure.grades.map(group => {
          const isActive = expandedGradeId === group.grade.id;
          const totalStudents = group.subjects.reduce((sum, s) => sum + s.studentCount, 0);
          const activeSubjects = group.subjects.filter(s => s.studentCount > 0).length;
          return (
            <Col key={group.grade.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                onClick={() => setExpandedGradeId(group.grade.id)}
                style={{
                  borderRadius: 14,
                  border: isActive
                    ? `2px solid ${group.grade.isDiversified ? '#fa541c' : '#1890ff'}`
                    : '1px solid rgba(0,0,0,0.06)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                styles={{ body: { padding: 16 } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: group.grade.isDiversified ? '#fa541c' : '#1890ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 900, fontSize: 18,
                  }}>
                    {group.grade.order || '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <Text strong style={{ fontSize: 15, display: 'block' }}>{group.grade.name}</Text>
                    <Space size={4}>
                      <Tag color={activeSubjects > 0 ? 'green' : 'default'} style={{ fontSize: 10, margin: 0 }}>
                        {activeSubjects}/{group.subjects.length} activas
                      </Tag>
                      <Tag style={{ fontSize: 10, margin: 0 }}>{totalStudents} estudiantes</Tag>
                    </Space>
                  </div>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Subjects list for selected grade */}
      {expandedGradeId && structure.grades.find(g => g.grade.id === expandedGradeId) && (
        <Card
          title={
            <Space>
              <BookOutlined />
              <span>Materias de {structure.grades.find(g => g.grade.id === expandedGradeId)?.grade.name}</span>
            </Space>
          }
          style={{ marginBottom: 24 }}
        >
          <Row gutter={[16, 16]}>
            {structure.grades.find(g => g.grade.id === expandedGradeId)?.subjects.map(subject => {
              const isEnabled = subject.studentCount > 0;
              return (
                <Col key={subject.id} xs={24} sm={12} md={8} lg={6}>
                  <Card
                    size="small"
                    style={{
                      borderRadius: 10,
                      opacity: isEnabled ? 1 : 0.6,
                      border: isEnabled ? '1px solid #d9f7be' : '1px solid #f0f0f0',
                      background: isEnabled ? '#f6ffed' : '#fafafa',
                    }}
                    styles={{ body: { padding: 12 } }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong ellipsis style={{ display: 'block', fontSize: 13 }}>
                          {subject.name}
                        </Text>
                        <Space size={4} style={{ marginTop: 4 }}>
                          {isEnabled ? (
                            <Tag color="success" style={{ fontSize: 10, margin: 0 }}>
                              <CheckCircleOutlined /> {subject.studentCount} est.
                            </Tag>
                          ) : (
                            <Tag color="default" style={{ fontSize: 10, margin: 0 }}>
                              <LockOutlined /> Sin estudiantes
                            </Tag>
                          )}
                        </Space>
                      </div>
                      <Button
                        type="primary"
                        size="small"
                        icon={<UserAddOutlined />}
                        onClick={() => {
                          const group = structure.grades.find(g => g.grade.id === expandedGradeId)!;
                          openRegModal(group, subject);
                        }}
                      >
                        Registrar
                      </Button>
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Card>
      )}

      {/* Nómina — estilo reparación */}
      {expandedGradeId && (
        <Card
          title={
            <Space>
              <span>Nómina de Materia Pendiente</span>
              {nomina?.grade && <Tag color="blue">{nomina.grade.name}</Tag>}
            </Space>
          }
          styles={{ body: { padding: 0 } }}
        >
          <Spin spinning={nominaLoading}>
            {nomina && nomina.students.length > 0 ? (
              <div className="mp-nomina-container">
                <table className="mp-nomina-sheet">
                  <thead>
                    <tr>
                      <th className="mp-col-idx">#</th>
                      <th className="mp-col-doc">Cédula</th>
                      <th className="mp-col-name">Apellidos y Nombres</th>
                      {nomina.subjects.map(subj => (
                        <th key={subj.id} className="mp-col-subj" title={subj.name}>
                          {subj.name.length > 15 ? subj.name.substring(0, 13) + '…' : subj.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {nomina.students.map((student, idx) => (
                      <tr key={student.inscriptionId}>
                        <td className="mp-cell-idx">{idx + 1}</td>
                        <td className="mp-cell-doc">
                          {student.documentType === 'Venezolano' ? 'V' : student.documentType === 'Extranjero' ? 'E' : student.documentType === 'Pasaporte' ? 'P' : 'CE'}-{student.studentDni}
                        </td>
                        <td className="mp-cell-name">{student.studentName}</td>
                        {nomina.subjects.map(subj => {
                          const studentSubj = student.subjects.find(s => s.subjectId === subj.id);
                          // Not registered → filled cell (greyed out)
                          if (!studentSubj) {
                            return <td key={subj.id} className="mp-cell-filled" />;
                          }
                          // Registered → show grade or blank
                          const fg = studentSubj.finalGrade;
                          const isApproved = fg?.status === 'aprobada';
                          return (
                            <td
                              key={subj.id}
                              className="mp-cell-blank"
                              onClick={() => {
                                setGradeModalStudent(student);
                                setGradeModalSubject(subj);
                                setGradeValue(fg?.finalScore ?? null);
                                setGradeModalOpen(true);
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              {fg && fg.finalScore != null ? (
                                <span className={isApproved ? 'mp-pass' : 'mp-fail'}>
                                  {Number(fg.finalScore).toFixed(0)}
                                </span>
                              ) : (
                                <span className="mp-pending">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <Empty description="No hay estudiantes registrados en materia pendiente para este grado" />
              </div>
            )}
          </Spin>
        </Card>
      )}

      {/* Registration Modal */}
      <Modal
        open={regModalOpen}
        title={
          <Space>
            <UserAddOutlined />
            <span>Registrar Estudiantes — {regModalSubject?.name}</span>
          </Space>
        }
        width={700}
        onCancel={() => setRegModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setRegModalOpen(false)}>Cancelar</Button>,
          <Button
            key="register"
            type="primary"
            icon={<SaveOutlined />}
            loading={acting}
            disabled={regSelected.size === 0}
            onClick={handleRegister}
          >
            Registrar {regSelected.size > 0 ? `(${regSelected.size})` : ''}
          </Button>,
        ]}
      >
        <Alert
          type="info"
          message={`Estudiantes de ${regModalGrade?.grade.name ? 'año siguiente' : ''} — se ordenan primero los de Materia Pendiente`}
          style={{ marginBottom: 16 }}
          showIcon
        />
        <Input.Search
          placeholder="Buscar por nombre, cédula o sección..."
          value={regSearch}
          onChange={e => setRegSearch(e.target.value)}
          style={{ marginBottom: 16 }}
        />
        <Spin spinning={regLoading}>
          <Table
            dataSource={filteredRegStudents}
            columns={regColumns}
            rowKey="inscriptionId"
            size="small"
            pagination={{ pageSize: 10, showSizeChanger: false }}
            rowSelection={{
              selectedRowKeys: Array.from(regSelected),
              onChange: (keys) => setRegSelected(new Set(keys as number[])),
            }}
          />
        </Spin>
      </Modal>

      {/* Grade editing modal */}
      <Modal
        open={gradeModalOpen}
        title="Registrar Nota de Materia Pendiente"
        onCancel={() => setGradeModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setGradeModalOpen(false)}>Cancelar</Button>,
          <Button
            key="save"
            type="primary"
            icon={<SaveOutlined />}
            loading={gradeSaving}
            disabled={gradeValue == null}
            onClick={handleSaveGrade}
          >
            Guardar
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>{gradeModalStudent?.studentName}</Text>
          <br />
          <Text type="secondary">{gradeModalSubject?.name}</Text>
        </div>
        <Divider />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text>Nota final:</Text>
          <InputNumber
            min={1}
            max={20}
            step={1}
            value={gradeValue}
            onChange={v => setGradeValue(v)}
            style={{ width: 120 }}
            autoFocus
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            (1-20, mínimo aprobatorio: 10)
          </Text>
        </div>
      </Modal>

      <style>{`
        .mp-nomina-container { overflow-x: auto; }
        .mp-nomina-sheet {
          width: 100%; border-collapse: collapse; font-size: 12px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .mp-nomina-sheet th {
          background: #f5f7fa; border: 1px solid #e8ecf0; padding: 8px 6px;
          text-align: center; font-weight: 700; color: #475066;
          position: sticky; top: 0; z-index: 1;
        }
        .mp-nomina-sheet td {
          border: 1px solid #e8ecf0; padding: 6px; text-align: center;
        }
        .mp-col-idx { width: 40px; }
        .mp-col-doc { width: 100px; }
        .mp-col-name { text-align: left; min-width: 200px; }
        .mp-col-subj { min-width: 60px; max-width: 100px; }
        .mp-cell-idx { background: #fafbfc; font-weight: 600; color: #8c8c8c; }
        .mp-cell-doc { font-size: 11px; color: #666; }
        .mp-cell-name { text-align: left; font-weight: 500; }
        .mp-cell-filled {
          background: #e8ecf0;
        }
        .mp-cell-blank {
          background: #fff; cursor: pointer; transition: background 0.15s;
        }
        .mp-cell-blank:hover { background: #f0f5ff; }
        .mp-pass { color: #52c41a; font-weight: 700; font-size: 14px; }
        .mp-fail { color: #ff4d4f; font-weight: 700; font-size: 14px; }
        .mp-pending { color: #d9d9d9; }
      `}</style>
    </div>
  );
};

export default PendingSubjectManagement;
