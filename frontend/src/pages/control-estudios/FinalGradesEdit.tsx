import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Table, Button, Select, Form, InputNumber, Input, Modal, message, Space, Tag, Typography, Row, Col, Alert, Spin } from 'antd';
import {
  SaveOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  LockOutlined,
  ReloadOutlined,
  BankOutlined
} from '@ant-design/icons';
import api from '@/services/api';
import finalGradeEditService, { type FinalGrade, type GradeType } from '@/services/finalGradeEditService';
import { gradeEditPermissionService } from '@/services/gradeEditPermissionService';
import StudentPlantelesModal from '@/components/shared/StudentPlantelesModal';
import PlantelAsyncSelect from '@/components/shared/PlantelAsyncSelect';
import { useGradeRounding } from '@/context/GradeRoundingContext';
import { formatGrade, formatGradePadded } from '@/utils/gradeFormat';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface SchoolPeriod {
  id: number;
  name: string;
  period: string;
  status: 'preinscripcion' | 'activo' | 'historico' | 'externo';
  isActive: boolean;
}

interface PermissionInfo {
  hasPermission: boolean;
  reason?: string;
  permission?: { id: number };
}

interface StudentRow {
  studentId: number;
  firstName: string;
  lastName: string;
  document: string;
  grades: { [subjectId: string]: { score: number | null; status: string; id?: number; inscriptionSubjectId: number; plantelId?: number | null; plantelCode?: string; gradeType?: GradeType | null; includeInAverage?: boolean } };
}

const FinalGradesEdit: React.FC = () => {
  const [schoolPeriods, setSchoolPeriods] = useState<SchoolPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [finalGrades, setFinalGrades] = useState<FinalGrade[]>([]);
  const [studentRows, setStudentRows] = useState<StudentRow[]>([]);
  const [originalStudentRows, setOriginalStudentRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [permission, setPermission] = useState<PermissionInfo | null>(null);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonForm] = Form.useForm();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingFilterChange, setPendingFilterChange] = useState<{ type: string; value: number | string | null } | null>(null);
  const [studentPlantelesModalOpen, setStudentPlantelesModalOpen] = useState(false);
  const [studentPlantelesContext, setStudentPlantelesContext] = useState<{ studentId: number; studentName: string } | null>(null);
  const { enableRounding } = useGradeRounding();
  const [maxGrade, setMaxGrade] = useState<number>(20);

  useEffect(() => {
    fetchSchoolPeriods();
    api.get('/settings').then((res) => {
      if (res.data?.max_grade) setMaxGrade(Number(res.data.max_grade));
    }).catch(() => { /* ignore */ });
  }, []);

  const fetchSchoolPeriods = async () => {
    try {
      setLoading(true);
      const response = await api.get('/academic/periods');
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
      setPermission(response);
      return response.hasPermission;
    } catch (err: unknown) {
      const error = err as { response?: { status: number } };
      if (error.response?.status === 403) {
        setPermission({ hasPermission: false, reason: 'No tiene permiso para este período' });
        return false;
      }
      console.error('Error checking permission:', err);
      return false;
    }
  };

  const handlePeriodChange = async (periodId: number | null) => {
    if (hasUnsavedChanges) {
      setPendingFilterChange({ type: 'period', value: periodId });
      setShowReasonModal(true);
      return;
    }
    
    setSelectedPeriod(periodId);
    setSelectedGrade(null);
    setSelectedSection(null);
    setFinalGrades([]);
    setStudentRows([]);
    setPermission(null);

    if (!periodId) return;

    setLoadingGrades(true);

    const hasPerm = await checkPermissionForPeriod(periodId);

    if (!hasPerm) {
      message.warning('No tiene permiso para modificar notas de este período');
      setLoadingGrades(false);
      return;
    }

    try {
      const grades = await finalGradeEditService.getFinalGradesByPeriod({ schoolPeriodId: periodId });
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

  const reloadGradesForSelection = async (gradeName: string | null, sectionName: string | null) => {
    if (!selectedPeriod || !gradeName || !sectionName || finalGrades.length === 0) return;
    const sample = finalGrades.find(grade => (
      grade.inscriptionSubject?.inscription?.grade?.name === gradeName
      && grade.inscriptionSubject?.inscription?.section?.name === sectionName
    ));
    const gradeId = sample?.gradeId ?? sample?.inscriptionSubject?.inscription?.grade?.id;
    const sectionId = sample?.inscriptionSubject?.inscription?.section?.id;
    if (!gradeId || !sectionId) return;
    try {
      const grades = await finalGradeEditService.getFinalGradesByPeriod({
        schoolPeriodId: selectedPeriod,
        gradeId,
        sectionId,
      });
      setFinalGrades(grades);
    } catch {
      message.error('Error al filtrar notas finales');
    }
  };

  const handleGradeChange = (gradeName: string | null) => {
    if (hasUnsavedChanges) {
      setPendingFilterChange({ type: 'grade', value: gradeName });
      setShowReasonModal(true);
      return;
    }
    setSelectedGrade(gradeName);
    void reloadGradesForSelection(gradeName, selectedSection);
  };

  const handleSectionChange = (sectionName: string | null) => {
    if (hasUnsavedChanges) {
      setPendingFilterChange({ type: 'section', value: sectionName });
      setShowReasonModal(true);
      return;
    }
    setSelectedSection(sectionName);
    void reloadGradesForSelection(selectedGrade, sectionName);
  };

  // Group grades by student and create dynamic columns
  const { studentRows: groupedStudents, uniqueSubjects } = useMemo(() => {
    if (!finalGrades.length || !selectedGrade || !selectedSection) {
      return { studentRows: [], uniqueSubjects: [] };
    }

    // Filter by grade and section
    const filtered = finalGrades.filter(grade => {
      const gradeName = grade.inscriptionSubject?.inscription?.grade?.name;
      const sectionName = grade.inscriptionSubject?.inscription?.section?.name;
      return gradeName === selectedGrade && sectionName === selectedSection;
    });

    // Get unique subjects for this grade/section/period
    const subjects = new Set<string>();
    filtered.forEach(grade => {
      const subject = grade.inscriptionSubject?.subject?.name;
      const subjectId = grade.inscriptionSubject?.subject?.id;
      if (subject && subjectId) {
        subjects.add(`${subjectId}-${subject}`);
      }
    });
    const uniqueSubjectsList = Array.from(subjects).sort();

    // Group by student
    const studentMap = new Map<number, StudentRow>();
    
    filtered.forEach(grade => {
      const student = grade.inscriptionSubject?.inscription?.student;
      const subject = grade.inscriptionSubject?.subject;
      
      if (!student || !subject) return;

      const studentId = student.id;
      
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          studentId,
          firstName: student.firstName,
          lastName: student.lastName,
          document: student.document,
          grades: {}
        });
      }

      const studentRow = studentMap.get(studentId)!;
      const subjectKey = `${subject.id}-${subject.name}`;
      
      studentRow.grades[subjectKey] = {
        score: grade.finalScore !== null ? Number(grade.finalScore) : 0,
        status: grade.status,
        id: grade.id,
        inscriptionSubjectId: grade.inscriptionSubjectId,
        plantelId: grade.plantelId,
        plantelCode: grade.plantel?.code,
        gradeType: grade.gradeType || 'regular',
        includeInAverage: grade.includeInAverage !== false
      };
    });

    return {
      studentRows: Array.from(studentMap.values()),
      uniqueSubjects: uniqueSubjectsList
    };
  }, [finalGrades, selectedGrade, selectedSection]);

  // Update student rows when grouping changes
  useEffect(() => {
    setStudentRows(groupedStudents);
    setOriginalStudentRows(JSON.parse(JSON.stringify(groupedStudents)));
  }, [groupedStudents]);

  // Keyboard navigation handler using data attributes
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      
      const currentInput = e.target as HTMLInputElement;
      const currentStudentId = parseInt(currentInput.dataset.studentId || '0');
      const currentSubjectIndex = parseInt(currentInput.dataset.subjectIndex || '0');
      
      const currentRowIndex = studentRows.findIndex(row => row.studentId === currentStudentId);
      
      let nextStudentId = currentStudentId;
      let nextSubjectIndex = currentSubjectIndex;
      
      if (e.key === 'ArrowUp' && currentRowIndex > 0) {
        nextStudentId = studentRows[currentRowIndex - 1].studentId;
      } else if (e.key === 'ArrowDown' && currentRowIndex < studentRows.length - 1) {
        nextStudentId = studentRows[currentRowIndex + 1].studentId;
      } else if (e.key === 'ArrowLeft' && currentSubjectIndex > 0) {
        nextSubjectIndex = currentSubjectIndex - 1;
      } else if (e.key === 'ArrowRight' && currentSubjectIndex < uniqueSubjects.length - 1) {
        nextSubjectIndex = currentSubjectIndex + 1;
      }
      
      const nextSelector = `input[data-student-id="${nextStudentId}"][data-subject-index="${nextSubjectIndex}"]`;
      const nextInput = document.querySelector(nextSelector) as HTMLInputElement;
      
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  }, [studentRows, uniqueSubjects]);

  // Handle grade change in cell
  const handleGradeValueChange = useCallback((studentId: number, subjectKey: string, value: number) => {
    setStudentRows(prev => prev.map(row => {
      if (row.studentId === studentId) {
        const newGrades = { ...row.grades };
        newGrades[subjectKey] = { ...newGrades[subjectKey], score: value };
        return { ...row, grades: newGrades };
      }
      return row;
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Handle grade type change
  const handleGradeTypeChange = useCallback((studentId: number, subjectKey: string, gradeType: GradeType) => {
    setStudentRows(prev => prev.map(row => {
      if (row.studentId === studentId) {
        const newGrades = { ...row.grades };
        newGrades[subjectKey] = { ...newGrades[subjectKey], gradeType };
        return { ...row, grades: newGrades };
      }
      return row;
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Handle plantel change directly (without modal)
  const handlePlantelChange = useCallback((studentId: number, subjectKey: string, plantelId: number | null, plantelCode?: string) => {
    setStudentRows(prev => prev.map(row => {
      if (row.studentId === studentId) {
        const newGrades = { ...row.grades };
        newGrades[subjectKey] = {
          ...newGrades[subjectKey],
          plantelId: plantelId,
          plantelCode: plantelCode
        };
        return { ...row, grades: newGrades };
      }
      return row;
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Handle opening student planteles modal
  const handleOpenStudentPlantelesModal = useCallback((studentId: number, studentName: string) => {
    setStudentPlantelesContext({ studentId, studentName });
    setStudentPlantelesModalOpen(true);
  }, []);

  // Handle saving planteles and grade types from student modal
  const handleSaveStudentPlanteles = useCallback((updates: { subjectKey: string; plantelId: number | null; gradeType: GradeType | null }[]) => {
    if (!studentPlantelesContext) return;

    setStudentRows(prev => prev.map(row => {
      if (row.studentId === studentPlantelesContext!.studentId) {
        const newGrades = { ...row.grades };
        updates.forEach(update => {
          if (newGrades[update.subjectKey]) {
            newGrades[update.subjectKey] = {
              ...newGrades[update.subjectKey],
              plantelId: update.plantelId,
              gradeType: update.gradeType
            };
          }
        });
        return { ...row, grades: newGrades };
      }
      return row;
    }));
    setHasUnsavedChanges(true);
    setStudentPlantelesModalOpen(false);
  }, [studentPlantelesContext]);

  // Save all changes
  const handleSaveChanges = async (reason: string, actCode: string) => {
    if (!permission || !selectedPeriod) {
      message.error('No se puede guardar: información faltante');
      return;
    }

    try {
      setLoading(true);
      const permId = permission.permission?.id || (permission as { id?: number }).id;
      if (!permId) {
        message.error('No se puede guardar: ID de permiso no encontrado');
        return;
      }

      // Collect only actually changed grades by comparing with original
      const changes: Array<{ gradeId?: number; inscriptionSubjectId: number; finalScore: number; status: 'aprobada' | 'reprobada'; plantelId?: number | null; gradeType?: GradeType | null }> = [];
      
      studentRows.forEach(row => {
        const originalRow = originalStudentRows.find(orig => orig.studentId === row.studentId);
        if (!originalRow) return;

        Object.entries(row.grades).forEach(([subjectKey, gradeData]) => {
          const originalGradeData = originalRow.grades[subjectKey];
          
          // Check if score, plantel, or gradeType actually changed
          const originalScore = originalGradeData?.score ?? 0;
          const currentScore = gradeData.score ?? 0;
          const originalPlantelId = originalGradeData?.plantelId ?? null;
          const currentPlantelId = gradeData.plantelId ?? null;
          const originalGradeType = originalGradeData?.gradeType ?? 'regular';
          const currentGradeType = gradeData.gradeType ?? 'regular';
          
          if (originalScore !== currentScore || originalPlantelId !== currentPlantelId || originalGradeType !== currentGradeType) {
            changes.push({
              gradeId: gradeData.id,
              inscriptionSubjectId: gradeData.inscriptionSubjectId,
              finalScore: currentScore,
              status: currentScore >= 10 ? 'aprobada' : 'reprobada',
              plantelId: currentPlantelId,
              gradeType: currentGradeType
            });
          }
        });
      });

      if (changes.length === 0) {
        message.info('No hay cambios para guardar');
        setHasUnsavedChanges(false);
        setShowReasonModal(false);
        reasonForm.resetFields();
        setLoading(false);
        return;
      }

      // Save each change
      for (const change of changes) {
        const gradeId = change.gradeId ? String(change.gradeId) : `new-${change.inscriptionSubjectId}`;
        
        await finalGradeEditService.updateFinalGrade(gradeId, {
          finalScore: change.finalScore,
          status: change.status,
          reason,
          permissionId: permId,
          inscriptionSubjectId: change.inscriptionSubjectId,
          actCode,
          plantelId: change.plantelId,
          gradeType: change.gradeType
        });
      }

      message.success(`Notas actualizadas correctamente (${changes.length} cambio${changes.length > 1 ? 's' : ''})`);
      setHasUnsavedChanges(false);
      setShowReasonModal(false);
      reasonForm.resetFields();

      // Reload grades
      const grades = await finalGradeEditService.getFinalGradesByPeriod({ schoolPeriodId: selectedPeriod });
      setFinalGrades(grades);
    } catch (err: unknown) {
      console.error('Error saving changes:', err);
      const error = err as { response?: { data?: { message?: string } } };
      message.error(error.response?.data?.message || 'Error al actualizar notas');
    } finally {
      setLoading(false);
    }
  };

  // Handle unsaved changes warning
  const handleUnsavedChangesConfirm = async () => {
    const reason = reasonForm.getFieldValue('reason');
    const actCode = reasonForm.getFieldValue('actCode');
    
    if (!reason) {
      message.warning('Debe ingresar una razón para guardar los cambios');
      return;
    }

    if (!actCode) {
      message.warning('Debe ingresar el número de acta');
      return;
    }

    await handleSaveChanges(reason, actCode);

    // Apply pending filter change
    if (pendingFilterChange) {
      const { type, value } = pendingFilterChange;
      if (type === 'period') {
        await handlePeriodChange(value as number | null);
      } else if (type === 'grade') {
        setSelectedGrade(value as string | null);
      } else if (type === 'section') {
        setSelectedSection(value as string | null);
      }
      setPendingFilterChange(null);
    }
  };

  const handleDiscardChanges = () => {
    setHasUnsavedChanges(false);
    setShowReasonModal(false);
    reasonForm.resetFields();

    // Apply pending filter change without saving
    if (pendingFilterChange) {
      const { type, value } = pendingFilterChange;
      if (type === 'period') {
        setSelectedPeriod(value as number | null);
        setSelectedGrade(null);
        setSelectedSection(null);
        setFinalGrades([]);
        setStudentRows([]);
      } else if (type === 'grade') {
        setSelectedGrade(value as string | null);
      } else if (type === 'section') {
        setSelectedSection(value as string | null);
      }
      setPendingFilterChange(null);
    }
  };

  // Extract unique grades and sections from all data (not filtered)
  const uniqueGrades = useMemo(() => {
    const grades = new Set<string>();
    finalGrades.forEach(grade => {
      const gradeName = grade.inscriptionSubject?.inscription?.grade?.name;
      if (gradeName) grades.add(gradeName);
    });
    return Array.from(grades).sort();
  }, [finalGrades]);

  const uniqueSections = useMemo(() => {
    const sections = new Set<string>();
    finalGrades.forEach(grade => {
      const section = grade.inscriptionSubject?.inscription?.section?.name;
      if (section) sections.add(section);
    });
    return Array.from(sections).sort();
  }, [finalGrades]);

  // Build dynamic columns
  const columns = useMemo(() => {
    const baseColumns = [
      {
        title: '',
        key: 'editRow',
        fixed: 'left' as const,
        width: 50,
        render: (_: unknown, record: StudentRow) => {
          const studentName = `${record.firstName} ${record.lastName}`;
          return (
            <Button
              size="small"
              icon={<BankOutlined />}
              onClick={() => handleOpenStudentPlantelesModal(record.studentId, studentName)}
              disabled={!permission?.hasPermission}
              title="Configurar fila"
            />
          );
        }
      },
      {
        title: 'Estudiante',
        dataIndex: 'studentName',
        key: 'studentName',
        fixed: 'left' as const,
        width: 200,
        render: (_: unknown, record: StudentRow) => {
          const studentName = `${record.firstName} ${record.lastName}`;
          return (
            <div>
              <div>
                <div style={{ fontWeight: 500 }}>{studentName}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>{record.document}</div>
              </div>
            </div>
          );
        }
      },
      {
        title: 'Promedio Acumulado',
        key: 'finalAverage',
        width: 120,
        fixed: 'left' as const,
        render: (_: unknown, record: StudentRow) => {
          // Calculate accumulated average from subject grades (filtered by includeInAverage)
          const grades = Object.values(record.grades);
          const eligibleGrades = grades.filter(g => g.includeInAverage !== false && g.score !== null && g.score !== undefined);

          if (eligibleGrades.length === 0) {
            return (
              <Text type="secondary" style={{ fontSize: 12 }}>
                N/A
              </Text>
            );
          }

          const total = eligibleGrades.reduce((sum, g) => sum + Math.max(1, g.score || 0), 0);
          const average = total / eligibleGrades.length;

          return (
            <Tag color={average >= 10 ? 'success' : 'error'} style={{ fontSize: 13, padding: '2px 8px' }}>
              {formatGradePadded(average, maxGrade)}
            </Tag>
          );
        }
      }
    ];

    // Add dynamic subject columns
    const subjectColumns = uniqueSubjects.map((subjectKey, subjectIndex) => {
      const subjectName = subjectKey.split('-')[1];
      return {
        title: subjectName,
        key: subjectKey,
        width: 120,
        render: (_: unknown, record: StudentRow) => {
          const gradeData = record.grades[subjectKey];
          
          if (!gradeData) {
            return (
              <div style={{ textAlign: 'center', color: '#ccc' }}>
                -
              </div>
            );
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <PlantelAsyncSelect
                value={gradeData.plantelId}
                currentLabel={gradeData.plantelCode}
                onChange={(plantelId, plantel) => handlePlantelChange(record.studentId, subjectKey, plantelId, plantel?.code)}
                disabled={!permission?.hasPermission}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <InputNumber
                  value={gradeData.score}
                  onChange={(value) => handleGradeValueChange(record.studentId, subjectKey, value || 0)}
                  onKeyDown={handleKeyDown}
                  min={0}
                  max={maxGrade}
                  step={0.01}
                  precision={2}
                  size="small"
                  style={{ flex: 1 }}
                  disabled={!permission?.hasPermission}
                  controls={false}
                  data-student-id={record.studentId}
                  data-subject-index={subjectIndex}
                />
                <Select
                  value={gradeData.gradeType || 'regular'}
                  onChange={(value) => handleGradeTypeChange(record.studentId, subjectKey, value as GradeType)}
                  size="small"
                  style={{ width: 100, flexShrink: 0 }}
                  disabled={!permission?.hasPermission}
                >
                  <Option value="regular">Regular</Option>
                  <Option value="revision">Revisión</Option>
                  <Option value="materia_pendiente">M. Pendiente</Option>
                  <Option value="revision_materia_pendiente">Rev. M.P.</Option>
                  <Option value="transferencia">Transferencia</Option>
                  <Option value="equivalencia">Equivalencia</Option>
                </Select>
              </div>
            </div>
          );
        }
      };
    });

    return [...baseColumns, ...subjectColumns];
  }, [uniqueSubjects, permission?.hasPermission, enableRounding, handleKeyDown, handleGradeValueChange, handleGradeTypeChange, handleOpenStudentPlantelesModal, handlePlantelChange]);

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

      {!permission?.hasPermission && selectedPeriod && permission && (
        <Alert
          message="Sin Permisos"
          description={permission.reason || 'No tiene permiso para modificar notas de este período'}
          type="warning"
          icon={<WarningOutlined />}
          showIcon
          closable
          style={{ marginBottom: '24px' }}
        />
      )}

      {permission?.hasPermission && selectedPeriod && (
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
          <Col xs={24} sm={8} md={6}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Período Escolar *
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

          {selectedPeriod && (
            <>
              <Col xs={24} sm={8} md={6}>
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    Grado *
                  </Text>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="Seleccione grado"
                    value={selectedGrade}
                    onChange={handleGradeChange}
                    size="large"
                  >
                    {uniqueGrades.map(grade => (
                      <Option key={grade} value={grade}>{grade}</Option>
                    ))}
                  </Select>
                </div>
              </Col>

              <Col xs={24} sm={8} md={6}>
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    Sección *
                  </Text>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="Seleccione sección"
                    value={selectedSection}
                    onChange={handleSectionChange}
                    size="large"
                  >
                    {uniqueSections.map(section => (
                      <Option key={section} value={section}>{section}</Option>
                    ))}
                  </Select>
                </div>
              </Col>

              <Col xs={24} sm={24} md={6}>
                <div style={{ marginTop: 24 }}>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={() => setShowReasonModal(true)}
                    disabled={!permission?.hasPermission || !hasUnsavedChanges}
                    loading={loading}
                    block
                  >
                    Guardar Cambios
                  </Button>
                  {hasUnsavedChanges && (
                    <Tag color="warning" style={{ marginTop: 8, display: 'block', textAlign: 'center' }}>
                      Hay cambios sin guardar
                    </Tag>
                  )}
                </div>
              </Col>
            </>
          )}
        </Row>

        {selectedPeriod && selectedGrade && selectedSection && (
          <div style={{ marginTop: '24px' }}>
            {loadingGrades ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spin size="large" />
              </div>
            ) : studentRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <WarningOutlined style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }} />
                <Title level={4} style={{ marginBottom: 8 }}>No hay estudiantes inscritos</Title>
                <Text type="secondary">
                  No se encontraron estudiantes inscritos en este grado, sección y período.
                </Text>
              </div>
            ) : (
              <Table
                columns={columns}
                dataSource={studentRows}
                rowKey="studentId"
                loading={loadingGrades}
                pagination={{ pageSize: 20 }}
                scroll={{ x: 1200 }}
                size="middle"
              />
            )}
          </div>
        )}
      </Card>

      <StudentPlantelesModal
        open={studentPlantelesModalOpen}
        studentName={studentPlantelesContext?.studentName || ''}
        subjects={
          studentPlantelesContext
            ? studentRows.find(r => r.studentId === studentPlantelesContext.studentId)?.grades
                ? Object.entries(studentRows.find(r => r.studentId === studentPlantelesContext.studentId)!.grades).map(([subjectKey, gradeData]) => ({
                    subjectKey,
                    subjectName: subjectKey.split('-')[1] || subjectKey,
                    plantelId: gradeData.plantelId,
                    plantelCode: gradeData.plantelCode,
                    gradeType: gradeData.gradeType
                  }))
                : []
            : []
        }
        onClose={() => setStudentPlantelesModalOpen(false)}
        onSave={handleSaveStudentPlanteles}
      />

      <Modal
        title={pendingFilterChange ? "Cambios sin guardar" : "Guardar Cambios"}
        open={showReasonModal}
        onCancel={handleDiscardChanges}
        footer={null}
        width={500}
      >
        <Alert
          message={pendingFilterChange ? "Tiene cambios sin guardar" : "Confirmar cambios"}
          description={pendingFilterChange 
            ? "Tiene cambios sin guardar. ¿Desea guardar los cambios antes de cambiar de filtro o descartar los cambios?" 
            : "Ingrese la razón de la modificación de notas."}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        {!pendingFilterChange && (
          <Form
            form={reasonForm}
            layout="vertical"
          >
            <Form.Item
              name="actCode"
              label="Número de Acta"
              rules={[{ required: true, message: 'Ingrese el número de acta' }]}
            >
              <Input
                placeholder="Ej: ACTA-2024-001"
                size="large"
              />
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
          </Form>
        )}

        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <Space>
            <Button onClick={handleDiscardChanges}>
              {pendingFilterChange ? "Descartar Cambios" : "Cancelar"}
            </Button>
            {!pendingFilterChange && (
              <Button
                type="primary"
                onClick={handleUnsavedChangesConfirm}
                loading={loading}
              >
                Guardar
              </Button>
            )}
            {pendingFilterChange && (
              <Button
                type="primary"
                onClick={() => {
                  setShowReasonModal(false);
                  reasonForm.setFieldsValue({ reason: '' });
                }}
              >
                Guardar Cambios
              </Button>
            )}
          </Space>
        </div>
      </Modal>
    </div>
  );
};

export default FinalGradesEdit;
