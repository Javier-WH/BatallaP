import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Input, DatePicker, Button, Select, InputNumber, Checkbox, Alert, message } from 'antd';
import { isAxiosError } from 'axios';
import api from '@/services/api';
import dayjs from 'dayjs';

const { Option } = Select;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EvaluationPlanItem {
  id: number;
  description: string;
  identificador: string;
  percentage: number;
  date: string;
  tecnica: string;
  temaGenerador?: string;
  referentesTeoricos?: string | string[];
  referentesEticos?: string | string[];
  indicador?: string | string[];
  objetivo?: string;
  tipoEvaluacion?: string;
  formaEvaluacion?: string;
  estrategiaEvaluacion?: string;
}

interface PlanItemFormValues {
  description?: string;
  tecnica: string;
  identificador: string;
  percentage: number;
  date: dayjs.Dayjs;
  estrategiaOption?: string;
  customEstrategia?: string;
  temaGenerador?: string;
  referentesTeoricosStr?: string[];
  referentesEticosSel?: string[];
  indicadoresStr?: string[];
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

// ── Constants ──────────────────────────────────────────────────────────────────

export const evaluationInstruments = [
  'Examen escrito',
  'Prueba objetiva (selección múltiple o verdadero/falso)',
  'Cuestionario diagnóstico',
  'Exposición oral',
  'Debate guiado',
  'Mesa redonda',
  'Proyecto integrador',
  'Estudio de caso',
  'Ensayo crítico',
  'Portafolio digital',
  'Trabajo de laboratorio',
  'Bitácora de aprendizaje',
  'Rúbrica de desempeño',
  'Observación de clase',
  'Demostración práctica',
  'Simulación o role play',
  'Mapa conceptual',
  'Investigación de campo',
  'Análisis de textos',
  'Diseño de prototipo',
  'Taller participativo',
  'Diario reflexivo',
  'Evaluación entre pares',
  'Autoevaluación dirigida',
  'Evaluación gamificada'
];

const CUSTOM_INSTRUMENT_VALUE = '__custom__';

// ── Helper: parse a JSON-or-array field safely ─────────────────────────────────

function parseArrayField(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return []; }
  }
  return [];
}

// ── Component ──────────────────────────────────────────────────────────────────

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
  existingItems,
}) => {
  const [planForm] = Form.useForm<PlanItemFormValues>();
  const instrumentSelection = Form.useWatch('estrategiaOption', planForm);
  const selectedDate = Form.useWatch('date', planForm);
  const [refTeoricos, setRefTeoricos] = useState<string[]>(['']);
  const [indicadores, setIndicadores] = useState<string[]>(['']);
  const [selectedEticos, setSelectedEticos] = useState<string[]>([]);
  const [allowOutOfOrder, setAllowOutOfOrder] = useState<boolean>(false);

  // Determine the latest evaluation item in existing items (excluding current editing item)
  const latestPreviousItem = useMemo(() => {
    if (!existingItems || existingItems.length === 0) return null;
    const filtered = existingItems.filter(item => !editingItem || item.id !== editingItem.id);
    if (filtered.length === 0) return null;
    return filtered.reduce((max, curr) => {
      if (!max.date) return curr;
      if (!curr.date) return max;
      return dayjs(curr.date).isAfter(dayjs(max.date)) ? curr : max;
    }, filtered[0]);
  }, [existingItems, editingItem]);

  // Check if selected date is strictly before the latest previous evaluation date
  const isDateBeforePrevious = useMemo(() => {
    if (!selectedDate || !latestPreviousItem?.date) return false;
    return selectedDate.isBefore(dayjs(latestPreviousItem.date), 'day');
  }, [selectedDate, latestPreviousItem]);

  // Reset allowOutOfOrder when date or modal state changes
  useEffect(() => {
    setAllowOutOfOrder(false);
  }, [open, selectedDate]);

  // Pre-fill form when editing or reset when creating
  useEffect(() => {
    if (!open) return;

    if (editingItem) {
      const refTeoricosParsed = parseArrayField(editingItem.referentesTeoricos);
      const eticosParsed = parseArrayField(editingItem.referentesEticos);
      const indicadoresParsed = parseArrayField(editingItem.indicador);

      setRefTeoricos(refTeoricosParsed.length > 0 ? refTeoricosParsed : ['']);
      setIndicadores(indicadoresParsed.length > 0 ? indicadoresParsed : ['']);
      setSelectedEticos(eticosParsed);

      const matchedInstrument = evaluationInstruments.find(
        instrument => instrument.toLowerCase() === editingItem.description.toLowerCase()
      );

      planForm.setFieldsValue({
        estrategiaOption: matchedInstrument ?? CUSTOM_INSTRUMENT_VALUE,
        customEstrategia: matchedInstrument ? undefined : editingItem.description,
        tecnica: editingItem.tecnica,
        identificador: editingItem.identificador,
        percentage: Number(editingItem.percentage),
        date: dayjs(editingItem.date),
        temaGenerador: editingItem.temaGenerador,
      });
    } else {
      planForm.resetFields();
      setRefTeoricos(['']);
      setIndicadores(['']);
      setSelectedEticos([]);
    }
  }, [open, editingItem, planForm]);

  const handleSavePlanItem = async (values: PlanItemFormValues) => {
    if (isDateBeforePrevious && !allowOutOfOrder) {
      message.warning('La fecha es anterior a la evaluación previa. Debes marcar la casilla de confirmación para guardar.');
      return;
    }

    const { estrategiaOption, customEstrategia } = values;
    const selectedEstrategia =
      estrategiaOption === CUSTOM_INSTRUMENT_VALUE
        ? customEstrategia?.trim()
        : estrategiaOption;

    if (!selectedEstrategia) {
      message.error('Selecciona o especifica una estrategia de evaluación.');
      return;
    }

    const data = {
      description: selectedEstrategia,
      tecnica: values.tecnica,
      identificador: values.identificador,
      periodGradeSubjectId,
      sectionId,
      termId,
      percentage: values.percentage,
      date: values.date ? values.date.format('YYYY-MM-DD') : undefined,
      temaGenerador: values.temaGenerador,
      referentesTeoricos: refTeoricos.filter(t => t.trim() !== ''),
      referentesEticos: selectedEticos,
      indicador: indicadores.filter(t => t.trim() !== ''),
    };

    try {
      if (editingItem) {
        await api.put(`/evaluation/plan/${editingItem.id}`, data);
        message.success('Item actualizado');
      } else {
        await api.post('/evaluation/plan', data);
        message.success('Item creado');
      }
      onClose();
      onSaved();
    } catch (error: unknown) {
      if (isAxiosError<{ message?: string }>(error)) {
        message.error(error.response?.data?.message || 'Error al guardar');
      } else {
        message.error('Error al guardar');
      }
    }
  };

  return (
    <Modal
      title={editingItem ? "Editar Evaluación" : "Nueva Evaluación"}
      open={open}
      onCancel={onClose}
      onOk={() => planForm.submit()}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onClose}>Cancelar</Button>,
        <Button
          key="submit"
          type="primary"
          disabled={isDateBeforePrevious && !allowOutOfOrder}
          onClick={() => planForm.submit()}
        >
          {editingItem ? 'Actualizar' : 'Guardar'}
        </Button>
      ]}
    >
      <Form form={planForm} layout="vertical" onFinish={handleSavePlanItem}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item 
            name="identificador" 
            label="Identificador" 
            rules={[{ required: true, message: 'Requerido' }, { max: 15, message: 'Máximo 15 caracteres' }]}
          >
            <Input placeholder="Ej: PRUEBA-1" maxLength={15} />
          </Form.Item>
          <Form.Item name="temaGenerador" label="Tema Generador">
            <Input placeholder="Describe el tema generador..." />
          </Form.Item>
        </div>

        <Form.Item label="Referentes Teóricos">
          {refTeoricos.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <Input
                value={item}
                placeholder={`Referente teórico ${idx + 1}`}
                onChange={(e) => {
                  const copy = [...refTeoricos];
                  copy[idx] = e.target.value;
                  setRefTeoricos(copy);
                }}
              />
              {refTeoricos.length > 1 && (
                <Button danger size="small" onClick={() => setRefTeoricos(refTeoricos.filter((_, i) => i !== idx))}>✕</Button>
              )}
            </div>
          ))}
          <Button type="dashed" size="small" onClick={() => setRefTeoricos([...refTeoricos, ''])} block>
            + Agregar referente teórico
          </Button>
        </Form.Item>

        <Form.Item label="Referentes Éticos e Indispensables">
          <Select
            mode="multiple"
            placeholder="Selecciona los referentes éticos e indispensables"
            value={selectedEticos}
            onChange={(values) => setSelectedEticos(values)}
            options={[
              { label: 'Referentes Éticos', options: [
                { value: 'A', label: 'A - Educar con, por y para todas y todos' },
                { value: 'B', label: 'B - Educar en, por y para la ciudadanía participativa y protagónica' },
                { value: 'C', label: 'C - Educar en, por y para el amor a la Patria, la soberanía y la autodeterminación' },
                { value: 'D', label: 'D - Educar en, por y para el amor, el respeto y la afirmación de la condición humana' },
                { value: 'E', label: 'E - Educar en, por y para la interculturalidad y la valoración de la diversidad' },
                { value: 'F', label: 'F - Educar en, por y para el trabajo productivo y la transformación social' },
                { value: 'G', label: 'G - Educar en, por y para la preservación de la vida en el planeta' },
                { value: 'H', label: 'H - Educar en, por y para la libertad y una visión crítica del mundo' },
                { value: 'I', label: 'I - Educar en, por y para la curiosidad y la investigación' },
              ]},
              { label: 'Referentes Indispensables', options: [
                { value: '1', label: '1 - Democracia Participativa y Protagónica, Igualdad, No Discriminación, DDHH, Equidad de Género' },
                { value: '2', label: '2 - Sociedad Multiétnica y Pluricultural, Diversidad e Interculturalidad, Patrimonio Cultural' },
                { value: '3', label: '3 - Independencia, Soberanía y Autodeterminación de los Pueblos, Mundo Multipolar' },
                { value: '4', label: '4 - Ideario Bolivariano, Unidad Latinoamericana y Caribeña' },
                { value: '5', label: '5 - Conocimiento del Espacio Geográfico e Historia de Venezuela, Familias y Comunidades' },
                { value: '6', label: '6 - Preservación de la Vida en el Planeta, Salud y Buen Vivir' },
                { value: '7', label: '7 - Petróleo y Energía' },
                { value: '8', label: '8 - Ciencia, Tecnología e Innovación' },
                { value: '9', label: '9 - Adolescencia y Juventud, Sexualidad Responsable, Educación Vial' },
                { value: '10', label: '10 - Actividad Física, Deporte y Recreación' },
                { value: '11', label: '11 - Seguridad y Soberanía Alimentaria' },
                { value: '12', label: '12 - Proceso Social de Trabajo' },
                { value: '13', label: '13 - Defensa Integral de la Nación' },
                { value: '14', label: '14 - Comunicación y Medios de Comunicación' },
              ]},
            ]}
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>

        <Form.Item 
          name="tecnica" 
          label="Técnicas e Instrumento" 
          rules={[{ required: true, message: 'Requerido' }, { max: 30, message: 'Máximo 30 caracteres' }]}
        >
          <Input placeholder="Ej: Observación Directa" maxLength={30} />
        </Form.Item>

        <Form.Item
          name="estrategiaOption"
          label="Estrategia de evaluación"
          rules={[{ required: true, message: 'Selecciona una estrategia de evaluación' }]}
        >
          <Select
            showSearch
            placeholder="Selecciona la estrategia de evaluación"
            optionFilterProp="children"
            filterOption={(input, option) =>
              String(option?.children ?? '')
                .toLowerCase()
                .includes(input.toLowerCase())
            }
            onChange={(value: string) => {
              planForm.setFieldValue('estrategiaOption', value);
              if (value !== CUSTOM_INSTRUMENT_VALUE) {
                planForm.setFieldValue('customEstrategia', undefined);
              }
            }}
          >
            {evaluationInstruments.map(instrument => (
              <Option key={instrument} value={instrument}>
                {instrument}
              </Option>
            ))}
            <Option value={CUSTOM_INSTRUMENT_VALUE}>Otro (especificar)</Option>
          </Select>
        </Form.Item>

        {instrumentSelection === CUSTOM_INSTRUMENT_VALUE && (
          <Form.Item
            name="customEstrategia"
            label="Describe la estrategia"
            rules={[
              { required: true, message: 'Ingresa la estrategia de evaluación' },
              { min: 3, message: 'Debe tener al menos 3 caracteres' }
            ]}
          >
            <Input placeholder="Ej: Evaluación práctica en laboratorio..." />
          </Form.Item>
        )}

        <Form.Item label="Indicador">
          {indicadores.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <Input
                value={item}
                placeholder={`Indicador ${idx + 1}`}
                onChange={(e) => {
                  const copy = [...indicadores];
                  copy[idx] = e.target.value;
                  setIndicadores(copy);
                }}
              />
              {indicadores.length > 1 && (
                <Button danger size="small" onClick={() => setIndicadores(indicadores.filter((_, i) => i !== idx))}>✕</Button>
              )}
            </div>
          ))}
          <Button type="dashed" size="small" onClick={() => setIndicadores([...indicadores, ''])} block>
            + Agregar indicador
          </Button>
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="percentage" label="Puntaje (1-100%)" rules={[{ required: true }]}>
            <InputNumber min={1} max={100} style={{ width: '100%' }} controls={false} />
          </Form.Item>
          <Form.Item
            name="date"
            label="Fecha de Evaluación"
            rules={[
              { required: true, message: 'Fecha requerida' },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();

                  // 1. Validar límites del período escolar (1 Sep startYear -> 31 Ago endYear)
                  const { minPeriodDate, maxPeriodDate, periodLabel } = getSchoolPeriodDateRange(schoolPeriod);
                  if (minPeriodDate && value.isBefore(minPeriodDate, 'day')) {
                    return Promise.reject(`La fecha debe ser a partir del 01/09/${minPeriodDate.year()} (inicio del período escolar${periodLabel ? ` ${periodLabel}` : ''})`);
                  }
                  if (maxPeriodDate && value.isAfter(maxPeriodDate, 'day')) {
                    return Promise.reject(`La fecha debe ser hasta el 31/08/${maxPeriodDate.year()} (cierre del período escolar${periodLabel ? ` ${periodLabel}` : ''})`);
                  }

                  // 2. Validar límites del lapso académico activo
                  const { openDate, closeDate } = selectedTermDateRange;
                  if (openDate && value.isBefore(openDate, 'day')) {
                    return Promise.reject(`La fecha debe ser a partir del ${openDate.format('DD/MM/YYYY')} (inicio del lapso)`);
                  }
                  if (closeDate && value.isAfter(closeDate, 'day')) {
                    return Promise.reject(`La fecha debe ser hasta el ${closeDate.format('DD/MM/YYYY')} (cierre del lapso)`);
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              disabledDate={(current) => {
                if (!current) return false;

                const { minPeriodDate, maxPeriodDate } = getSchoolPeriodDateRange(schoolPeriod);
                if (minPeriodDate && current.isBefore(minPeriodDate, 'day')) return true;
                if (maxPeriodDate && current.isAfter(maxPeriodDate, 'day')) return true;

                const { openDate, closeDate } = selectedTermDateRange;
                if (openDate && current.isBefore(openDate, 'day')) return true;
                if (closeDate && current.isAfter(closeDate, 'day')) return true;

                return false;
              }}
            />
          </Form.Item>
        </div>
        {isDateBeforePrevious && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message="Fecha anterior a la evaluación previa"
            description={`La fecha seleccionada (${selectedDate?.format('DD/MM/YYYY')}) es anterior a la evaluación previa "${latestPreviousItem?.identificador || ''}" (${dayjs(latestPreviousItem?.date).format('DD/MM/YYYY')}). Para guardar, debes marcar la casilla de confirmación.`}
          />
        )}
        {isDateBeforePrevious && (
          <Checkbox
            checked={allowOutOfOrder}
            onChange={(e) => setAllowOutOfOrder(e.target.checked)}
            style={{ marginBottom: 16 }}
          >
            Confirmar fecha anterior a la evaluación previa
          </Checkbox>
        )}
      </Form>
    </Modal>
  );
};

export default EvaluationPlanItemModal;
