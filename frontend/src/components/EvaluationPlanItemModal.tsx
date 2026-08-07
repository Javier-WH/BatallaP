import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, DatePicker, Button, Select, InputNumber, message, Checkbox } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '@/services/api';
import dayjs from 'dayjs';

const { Option } = Select;

export interface EvaluationPlanItem {
  id: number;
  description: string;
  percentage: number;
  date: string;
  thematicComponentId?: number | null;
  thematicComponent?: { id: number; title: string } | null;
  criteria?: { id: number; name: string; points: number }[];
  evaluationType?: string | null;
}

interface PlanItemFormValues {
  description?: string;
  percentage: number;
  date: dayjs.Dayjs | null;
  thematicComponentId?: number;
  evaluationType?: string[] | null;
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
  thematicComponents?: { id: number; title: string }[];
}

export function getSchoolPeriodDateRange(periodInput?: SchoolPeriodInfo | string) {
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

interface CriteriaRow {
  id?: number;
  name: string;
  points: number;
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
}) => {
  const [form] = Form.useForm<PlanItemFormValues>();
  const [saving, setSaving] = useState(false);
  const [criteria, setCriteria] = useState<CriteriaRow[]>([]);
  const [evaluationType, setEvaluationType] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.setFieldsValue({
          description: editingItem.description,
          percentage: editingItem.percentage,
          date: editingItem.date ? dayjs(editingItem.date) : null,
          thematicComponentId: editingItem.thematicComponentId || undefined,
        });
        setEvaluationType(editingItem.evaluationType ? editingItem.evaluationType.split(',') : []);
        setCriteria(
          (editingItem.criteria || []).map(c => ({ id: c.id, name: c.name, points: c.points }))
        );
      } else {
        form.resetFields();
        setCriteria([]);
        setEvaluationType([]);
      }
    }
  }, [open, editingItem, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (evaluationType.length === 0) {
        message.warning('Seleccione al menos un tipo de evaluación');
        return;
      }
      setSaving(true);

      const payload = {
        periodGradeSubjectId,
        sectionId,
        termId,
        description: values.description,
        percentage: Number(values.percentage),
        date: values.date ? values.date.format('YYYY-MM-DD') : null,
        thematicComponentId: values.thematicComponentId || null,
        evaluationType: evaluationType.length > 0 ? evaluationType.join(',') : null,
        criteria: criteria.map(c => ({ name: c.name, points: Number(c.points) })),
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
    } catch (error: any) {
      if (error?.response?.data?.message) {
        message.error(error.response.data.message);
      } else if (error?.errorFields) {
        message.error('Por favor complete todos los campos requeridos');
      } else {
        message.error('Error al guardar');
      }
    } finally {
      setSaving(false);
    }
  };

  const addCriteria = () => {
    setCriteria([...criteria, { name: '', points: 0 }]);
  };

  const removeCriteria = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const updateCriteria = (index: number, field: keyof CriteriaRow, value: string | number) => {
    setCriteria(criteria.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
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

        <Form.Item name="thematicComponentId" label="Componente temático (opcional)">
          <Select
            allowClear
            placeholder="Seleccionar componente temático"
            notFoundContent="No hay componentes creados"
          >
            {thematicComponents.map(tc => (
              <Option key={tc.id} value={tc.id}>{tc.title}</Option>
            ))}
          </Select>
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
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>

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
          {criteria.map((c, index) => (
            <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <Input
                placeholder="Nombre del criterio"
                value={c.name}
                onChange={e => updateCriteria(index, 'name', e.target.value)}
                style={{ flex: 1 }}
              />
              <InputNumber
                placeholder="Pts"
                min={0}
                value={c.points}
                onChange={val => updateCriteria(index, 'points', val || 0)}
                style={{ width: 80 }}
              />
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => removeCriteria(index)}
              />
            </div>
          ))}
        </div>
      </Form>
    </Modal>
  );
};

export default EvaluationPlanItemModal;

