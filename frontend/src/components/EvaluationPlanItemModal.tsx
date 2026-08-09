import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, DatePicker, Button, Select, InputNumber, message, Checkbox, AutoComplete } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '@/services/api';
import dayjs from 'dayjs';

interface ThematicContentOption {
  id: number;
  title: string;
  order: number;
}

interface ThematicComponentOption {
  id: number;
  title: string;
  order?: number;
  contents?: ThematicContentOption[];
}

export interface EvaluationPlanItem {
  id: number;
  description: string;
  percentage: number;
  date: string;
  thematicComponentId?: number | null;
  thematicContentIds?: number[] | null;
  thematicComponent?: { id: number; title: string } | null;
  criteria?: { id: number; name: string; points: number; indicators?: { id: number; name: string; points: number }[] }[];
  evaluationType?: string | null;
  tecnica?: string | null;
  instrumento?: string | null;
}

interface PlanItemFormValues {
  description?: string;
  percentage: number;
  date: dayjs.Dayjs | null;
  thematicContentIds?: number[];
  evaluationType?: string[] | null;
  tecnica?: string;
  instrumento?: string;
}

export interface SchoolPeriodInfo {
  id?: number;
  name?: string;
  period?: string;
  startYear?: number;
  endYear?: number;
}

export interface EvaluationPlanItemModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingItem: EvaluationPlanItem | null;
  periodGradeSubjectId: number;
  sectionId: number;
  termId: number;
  selectedTermDateRange: { openDate: dayjs.Dayjs | null; closeDate: dayjs.Dayjs | null };
  schoolPeriod?: SchoolPeriodInfo | string;
  existingItems?: EvaluationPlanItem[];
  thematicComponents?: ThematicComponentOption[];
  maxGrade?: number;
}

function getSchoolPeriodDateRange(periodInput?: SchoolPeriodInfo | string) {
  if (!periodInput) return { minPeriodDate: null, maxPeriodDate: null, periodLabel: '' };

  let startYear: number | undefined;
  let endYear: number | undefined;

  if (typeof periodInput === 'object') {
    if (periodInput.startYear && periodInput.endYear) {
      startYear = Number(periodInput.startYear);
      endYear = Number(periodInput.endYear);
    } else {
      const str = periodInput.period || periodInput.name || '';
      const match = str.match(/\b(20\d{2})\s*[-/]\s*(20\d{2})\b/);
      if (match) {
        startYear = parseInt(match[1], 10);
        endYear = parseInt(match[2], 10);
      }
    }
  } else if (typeof periodInput === 'string') {
    const match = periodInput.match(/\b(20\d{2})\s*[-/]\s*(20\d{2})\b/);
    if (match) {
      startYear = parseInt(match[1], 10);
      endYear = parseInt(match[2], 10);
    }
  }

  if (startYear && endYear) {
    const minPeriodDate = dayjs(`${startYear}-09-01`);
    const maxPeriodDate = dayjs(`${endYear}-08-31`);
    return { minPeriodDate, maxPeriodDate, periodLabel: `${startYear}-${endYear}` };
  }

  return { minPeriodDate: null, maxPeriodDate: null, periodLabel: '' };
}

// ── Component ──────────────────────────────────────────────────────────────────

interface IndicatorRow {
  id?: number;
  name: string;
  points: number;
}

interface CriteriaRow {
  id?: number;
  name: string;
  points: number;
  indicators: IndicatorRow[];
}

const EvaluationPlanItemModal: React.FC<EvaluationPlanItemModalProps> = ({
  open,
  onClose,
  onSaved,
  editingItem,
  periodGradeSubjectId,
  sectionId,
  termId,
  selectedTermDateRange,
  schoolPeriod,
  thematicComponents = [],
  existingItems = [],
  maxGrade = 20,
}) => {
  const [form] = Form.useForm<PlanItemFormValues>();
  const [saving, setSaving] = useState(false);
  const [criteria, setCriteria] = useState<CriteriaRow[]>([]);
  const [evaluationType, setEvaluationType] = useState<string[]>([]);
  const [percentageValue, setPercentageValue] = useState<number | null>(null);

  const thematicContentOptions = thematicComponents.flatMap((component, componentIndex) =>
    (component.contents || []).map((content, contentIndex) => ({
      ...content,
      componentTitle: component.title,
      number: `${componentIndex + 1}.${contentIndex + 1}`,
    }))
  );

  const tecnicaOptions = [...new Set(
    (existingItems || []).map(i => i.tecnica).filter(Boolean) as string[]
  )].map(v => ({ value: v }));

  const instrumentoOptions = [...new Set(
    (existingItems || []).map(i => i.instrumento).filter(Boolean) as string[]
  )].map(v => ({ value: v }));

  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.setFieldsValue({
          description: editingItem.description,
          percentage: editingItem.percentage,
          date: editingItem.date ? dayjs(editingItem.date) : null,
          thematicContentIds: editingItem.thematicContentIds?.length
            ? editingItem.thematicContentIds
            : thematicComponents
              .filter(component => component.id === editingItem.thematicComponentId)
              .flatMap(component => (component.contents || []).map(content => content.id)),
          tecnica: editingItem.tecnica || '',
          instrumento: editingItem.instrumento || '',
        });
        setEvaluationType(editingItem.evaluationType ? editingItem.evaluationType.split(',') : []);
        setPercentageValue(editingItem.percentage);
        setCriteria(
          (editingItem.criteria || []).map(c => ({
            id: c.id,
            name: c.name,
            points: c.points,
            indicators: (c.indicators || []).map(ind => ({ id: ind.id, name: ind.name, points: ind.points })),
          }))
        );
      } else {
        form.resetFields();
        setCriteria([]);
        setEvaluationType([]);
        setPercentageValue(null);
      }
    }
  }, [open, editingItem, form, thematicComponents]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (evaluationType.length === 0) {
        message.warning('Seleccione al menos un tipo de evaluación');
        return;
      }
      const invalidCriteria = criteria.filter(c => !c.name.trim() || c.points <= 0);
      if (invalidCriteria.length > 0) {
        message.warning('Cada criterio debe tener un nombre y un puntaje mayor a 0');
        return;
      }
      const exceedingCriteria = criteria.filter(c => c.points > maxGrade);
      if (exceedingCriteria.length > 0) {
        message.warning(`Los criterios no pueden superar ${maxGrade} puntos (nota máxima)`);
        return;
      }
      if (criteria.length > 0) {
        const totalCriteriaPoints = criteria.reduce((acc, c) => acc + Number(c.points || 0), 0);
        if (Math.abs(totalCriteriaPoints - maxGrade) > 0.01) {
          message.warning(`La suma de los puntos de los criterios es ${totalCriteriaPoints}, debe ser exactamente ${maxGrade} (nota máxima)`);
          return;
        }
      }
      // Validate indicators per criterion: must have at least one, sum must equal criterion points
      for (const c of criteria) {
        if (c.indicators.length === 0) {
          message.warning(`El criterio "${c.name}" debe tener al menos un indicador`);
          return;
        }
        const indSum = c.indicators.reduce((acc, ind) => acc + Number(ind.points || 0), 0);
        if (Math.abs(indSum - Number(c.points)) > 0.01) {
          message.warning(`Los indicadores de "${c.name}" suman ${indSum} pts, deben sumar exactamente ${c.points} pts`);
          return;
        }
      }
      setSaving(true);

      const payload = {
        periodGradeSubjectId,
        sectionId,
        termId,
        description: values.description,
        percentage: Number(values.percentage),
        date: values.date ? values.date.format('YYYY-MM-DD') : null,
        thematicContentIds: values.thematicContentIds?.length ? values.thematicContentIds : null,
        evaluationType: evaluationType.length > 0 ? evaluationType.join(',') : null,
        tecnica: values.tecnica || null,
        instrumento: values.instrumento || null,
        criteria: criteria.map(c => ({
          name: c.name,
          points: Number(c.points),
          indicators: c.indicators.map(ind => ({ name: ind.name, points: Number(ind.points) })),
        })),
      };

      if (editingItem) {
        await api.put(`/evaluation/plan/${editingItem.id}`, payload);
        message.success('Estrategia actualizada');
      } else {
        await api.post('/evaluation/plan', payload);
        message.success('Estrategia creada');
      }

      onSaved();
      onClose();
    } catch (error: unknown) {
      const errorData = error as { response?: { data?: { message?: string } }; errorFields?: unknown };
      if (errorData.response?.data?.message) {
        message.error(errorData.response.data.message);
      } else if (errorData.errorFields) {
        message.error('Por favor complete todos los campos requeridos');
      } else {
        message.error('Error al guardar');
      }
    } finally {
      setSaving(false);
    }
  };

  const addCriteria = () => {
    setCriteria([...criteria, { name: '', points: 0, indicators: [] }]);
  };

  const removeCriteria = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const updateCriteria = (index: number, field: keyof CriteriaRow, value: string | number) => {
    setCriteria(criteria.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const addIndicator = (critIndex: number) => {
    setCriteria(criteria.map((c, i) =>
      i === critIndex ? { ...c, indicators: [...c.indicators, { name: '', points: 0 }] } : c
    ));
  };

  const removeIndicator = (critIndex: number, indIndex: number) => {
    setCriteria(criteria.map((c, i) =>
      i === critIndex ? { ...c, indicators: c.indicators.filter((_, j) => j !== indIndex) } : c
    ));
  };

  const updateIndicator = (critIndex: number, indIndex: number, field: keyof IndicatorRow, value: string | number) => {
    setCriteria(criteria.map((c, i) =>
      i === critIndex
        ? { ...c, indicators: c.indicators.map((ind, j) => (j === indIndex ? { ...ind, [field]: value } : ind)) }
        : c
    ));
  };

  const { minPeriodDate, maxPeriodDate } = getSchoolPeriodDateRange(schoolPeriod);

  return (
    <Modal
      open={open}
      title={editingItem ? 'Editar Estrategia de Evaluación' : 'Nueva Estrategia de Evaluación'}
      onCancel={onClose}
      width={640}
      footer={[
        <Button key="cancel" onClick={onClose}>Cancelar</Button>,
        <Button key="save" type="primary" loading={saving} onClick={handleSave}>
          {editingItem ? 'Actualizar' : 'Crear'}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="description"
          label="Nombre de la estrategia"
          rules={[{ required: true, message: 'Ingrese el nombre de la estrategia' }]}
        >
          <Input placeholder="Ej: Examen, Exposición, Trabajo escrito..." />
        </Form.Item>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="tecnica" label="Técnica" style={{ flex: 1 }} rules={[{ required: true, message: 'Ingrese la técnica' }]}>
            <AutoComplete
              options={tecnicaOptions}
              placeholder="Ej: Observación, Entrevista, Encuesta..."
              filterOption={(input, option) =>
                (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
              }
              allowClear
            />
          </Form.Item>
          <Form.Item name="instrumento" label="Instrumento" style={{ flex: 1 }} rules={[{ required: true, message: 'Ingrese el instrumento' }]}>
            <AutoComplete
              options={instrumentoOptions}
              placeholder="Ej: Lista de cotejo, Rúbrica, Cuestionario..."
              filterOption={(input, option) =>
                (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
              }
              allowClear
            />
          </Form.Item>
        </div>

        <Form.Item name="thematicContentIds" label="Contenidos temáticos (opcional)">
          <Select
            mode="multiple"
            allowClear
            placeholder="Seleccionar uno o más contenidos"
            notFoundContent="No hay contenidos creados"
            optionFilterProp="label"
            options={thematicContentOptions.map(content => ({
              value: content.id,
              label: `${content.number} · ${content.title} — ${content.componentTitle}`,
            }))}
            tagRender={({ label, closable, onClose }) => (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 8px',
                  margin: '2px',
                  borderRadius: 6,
                  backgroundColor: 'var(--color-accent, #1677ff)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 500,
                  lineHeight: '20px',
                  height: 28,
                  gap: 6,
                }}
              >
                {label}
                {closable && (
                  <span
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    style={{ cursor: 'pointer', fontWeight: 700, fontSize: 16, lineHeight: 1 }}
                  >
                    ×
                  </span>
                )}
              </span>
            )}
          />
        </Form.Item>

        <Form.Item label="Tipo de evaluación" required>
          <Checkbox.Group
            value={evaluationType}
            onChange={(checkedValues) => {
              setEvaluationType(checkedValues as string[]);
            }}
            style={{ display: 'flex', gap: 8 }}
          >
            {(['intra', 'inter', 'trans'] as const).map(type => (
              <Checkbox
                key={type}
                value={type}
                style={{
                  border: `1px solid ${evaluationType.includes(type) ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  borderRadius: 8,
                  padding: '4px 12px',
                  backgroundColor: evaluationType.includes(type) ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
                  fontWeight: evaluationType.includes(type) ? 600 : 400,
                  transition: 'all 0.2s',
                }}
              >
                {type === 'intra' ? 'Intra' : type === 'inter' ? 'Inter' : 'Trans'}
              </Checkbox>
            ))}
          </Checkbox.Group>
          {evaluationType.length === 0 && (
            <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>Seleccione al menos un tipo de evaluación</div>
          )}
        </Form.Item>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item
            name="percentage"
            label="Porcentaje (%)"
            rules={[{ required: true, message: 'Ingrese el porcentaje' }]}
            style={{ flex: 1 }}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} onChange={(val) => setPercentageValue(val as number | null)} />
          </Form.Item>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', paddingBottom: 24 }}>
            {percentageValue != null && percentageValue > 0 && (
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-accent)',
                backgroundColor: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
                padding: '4px 12px',
                borderRadius: 8,
              }}>
                Equivale a {((percentageValue / 100) * maxGrade).toFixed(1)} puntos de {maxGrade}
              </div>
            )}
          </div>

          <Form.Item
            name="date"
            label="Fecha"
            rules={[{ required: true, message: 'Seleccione la fecha' }]}
            style={{ flex: 1 }}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              disabledDate={(current) => {
                if (!current) return false;
                if (selectedTermDateRange.openDate && current < selectedTermDateRange.openDate.startOf('day')) return true;
                if (selectedTermDateRange.closeDate && current > selectedTermDateRange.closeDate.endOf('day')) return true;
                if (minPeriodDate && current < minPeriodDate.startOf('day')) return true;
                if (maxPeriodDate && current > maxPeriodDate.endOf('day')) return true;
                return false;
              }}
            />
          </Form.Item>
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>Criterios de evaluación</span>
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addCriteria}>
              Agregar criterio
            </Button>
          </div>
          {criteria.length === 0 && (
            <div style={{ color: '#999', fontSize: 12, padding: '8px 0' }}>
              No hay criterios. Los criterios son descriptivos (puntualidad, pulcritud, etc.) y no se califican individualmente.
            </div>
          )}
          {criteria.map((c, index) => {
            const exceedsMax = c.points > maxGrade;
            const indSum = c.indicators.reduce((acc, ind) => acc + Number(ind.points || 0), 0);
            const indMismatch = c.indicators.length > 0 && Math.abs(indSum - Number(c.points)) > 0.01;
            const indExceeds = indMismatch;
            return (
            <div key={index} style={{ marginBottom: 12, padding: 8, border: '1px solid var(--color-border, #d9d9d9)', borderRadius: 8 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <Input
                  placeholder="Nombre del criterio"
                  value={c.name}
                  onChange={e => updateCriteria(index, 'name', e.target.value)}
                  style={{ flex: 1 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <InputNumber
                    placeholder="Pts"
                    min={0}
                    value={c.points}
                    onChange={val => updateCriteria(index, 'points', val || 0)}
                    style={{ width: 80 }}
                    status={exceedsMax ? 'error' : undefined}
                  />
                  {exceedsMax && (
                    <span style={{ color: '#ff4d4f', fontSize: 10, marginTop: 2 }}>Máx: {maxGrade} pts</span>
                  )}
                </div>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeCriteria(index)}
                />
              </div>
              {/* Indicators */}
              <div style={{ paddingLeft: 16, borderLeft: '2px solid var(--color-border, #e8e8e8)' }}>
                {c.indicators.map((ind, indIndex) => (
                  <div key={indIndex} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' }}>
                    <Input
                      placeholder="Nombre del indicador"
                      value={ind.name}
                      onChange={e => updateIndicator(index, indIndex, 'name', e.target.value)}
                      style={{ flex: 1, fontSize: 12 }}
                      size="small"
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <InputNumber
                        placeholder="Pts"
                        min={0}
                        value={ind.points}
                        onChange={val => updateIndicator(index, indIndex, 'points', val || 0)}
                        style={{ width: 70 }}
                        size="small"
                        status={indExceeds ? 'error' : undefined}
                      />
                    </div>
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => removeIndicator(index, indIndex)}
                    />
                  </div>
                ))}
                {indMismatch && (
                  <div style={{ color: '#ff4d4f', fontSize: 10, marginTop: 2, marginBottom: 4 }}>
                    Los indicadores suman {indSum} pts, deben sumar exactamente {c.points} pts
                  </div>
                )}
                <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => addIndicator(index)} style={{ marginTop: 4 }}>
                  Agregar indicador
                </Button>
              </div>
            </div>
            );
          })}
        </div>
      </Form>
    </Modal>
  );
};

export default EvaluationPlanItemModal;

