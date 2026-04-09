import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal, Form, Input, Select, DatePicker, Radio, Row, Col,
  Alert, Button, Collapse, Space, message, Tag, Divider, Typography
} from 'antd';
import { ExclamationCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { retrySingleRow } from '@/services/bulkEnrollment';
import type { RetrySingleResponse } from '@/services/bulkEnrollment';

const { Option } = Select;
const { Text } = Typography;

type VenezuelaMunicipality = { municipio: string; parroquias: string[] };
type VenezuelaState = { estado: string; municipios: VenezuelaMunicipality[] };

type EnrollStructureItem = {
  id: number;
  gradeId: number;
  schoolPeriodId: number;
  grade?: { id: number; name: string };
  sections?: { id: number; name: string }[];
};

type SchoolPeriod = {
  id: number;
  period: string;
  name: string;
  isActive: boolean;
};

export type BulkRetryModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (rowNumber: number) => void;
  rowNumber: number;
  payload: Record<string, unknown> | null;
  errors: string[];
  processMessage?: string;
  enrollStructure: EnrollStructureItem[];
  venezuelaLocations: VenezuelaState[];
  activePeriod: SchoolPeriod | null;
};

const ESCOLARIDAD_OPTIONS = [
  { label: 'Regular', value: 'regular' },
  { label: 'Repitiente', value: 'repitiente' },
  { label: 'Materia pendiente', value: 'materia_pendiente' }
];

const REPRESENTATIVE_TYPE_OPTIONS = [
  { label: 'Madre', value: 'mother' },
  { label: 'Padre', value: 'father' },
  { label: 'Otro representante', value: 'other' }
];

const GUARDIAN_DOC_OPTIONS = [
  { label: 'Venezolano', value: 'Venezolano' },
  { label: 'Extranjero', value: 'Extranjero' },
  { label: 'Pasaporte', value: 'Pasaporte' }
];

const selectFilter = (input: string, option?: { label?: string }) =>
  (option?.label ?? '').toLowerCase().includes(input.toLowerCase());

const buildMunOpts = (locs: VenezuelaState[], state?: string | null) => {
  if (!state) return [];
  const s = locs.find((l) => l.estado === state);
  return s ? s.municipios.map((m) => ({ label: m.municipio, value: m.municipio })) : [];
};

const buildParOpts = (locs: VenezuelaState[], state?: string | null, mun?: string | null) => {
  if (!state || !mun) return [];
  const s = locs.find((l) => l.estado === state);
  const m = s?.municipios.find((mu) => mu.municipio === mun);
  return m ? m.parroquias.map((p) => ({ label: p, value: p })) : [];
};

function parseErrorFields(errors: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const err of errors) {
    const lower = err.toLowerCase();

    if (lower.includes('nombres del estudiante') || (lower.includes('firstname') && !lower.includes('madre') && !lower.includes('padre') && !lower.includes('representante')))
      map.set('firstName', err);
    if (lower.includes('apellidos del estudiante') || (lower.includes('lastname') && !lower.includes('madre') && !lower.includes('padre') && !lower.includes('representante')))
      map.set('lastName', err);
    if (lower.includes('género') || lower.includes('gender'))
      map.set('gender', err);
    if (lower.includes('fecha de nacimiento') || lower.includes('birthdate'))
      map.set('birthdate', err);
    if ((lower.includes('documento') || lower.includes('document')) && !lower.includes('madre') && !lower.includes('padre') && !lower.includes('representante'))
      map.set('document', err);

    const fieldMatch = err.match(/El campo (\w+) es obligatorio/i);
    if (fieldMatch) map.set(fieldMatch[1], err);

    if (lower.includes('período') || lower.includes('periodo'))
      map.set('schoolPeriodId', err);
    if (lower.includes('grado') && !lower.includes('período'))
      map.set('gradeId', err);
    if (lower.includes('sección'))
      map.set('sectionId', err);

    const guardianMissingMatch = err.match(
      /Faltan campos obligatorios para (la madre|el padre|el representante): (.+)/i
    );
    if (guardianMissingMatch) {
      const prefix =
        guardianMissingMatch[1] === 'la madre'
          ? 'mother'
          : guardianMissingMatch[1] === 'el padre'
            ? 'father'
            : 'representative';
      guardianMissingMatch[2]
        .split(',')
        .map((f) => f.trim())
        .forEach((f) => map.set(`${prefix}.${f}`, err));
    }

    if ((lower.includes('madre') || lower.includes('mother')) && lower.includes('obligatori'))
      map.set('mother', err);
    if ((lower.includes('padre') || lower.includes('father')) && lower.includes('obligatori'))
      map.set('father', err);
    if (
      lower.includes('representante') &&
      !lower.includes('madre') &&
      !lower.includes('padre') &&
      lower.includes('obligatori')
    )
      map.set('representative', err);

    const seqMatches = err.matchAll(/\[(\w+)\]/g);
    for (const m of seqMatches) {
      map.set(m[1], err);
    }

    if (lower.includes('duplicado') && lower.includes('document'))
      map.set('document', err);
  }
  return map;
}

const BulkRetryModal: React.FC<BulkRetryModalProps> = ({
  open,
  onClose,
  onSuccess,
  rowNumber,
  payload,
  errors,
  processMessage,
  enrollStructure,
  venezuelaLocations,
  activePeriod
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [nameConflict, setNameConflict] = useState<RetrySingleResponse | null>(null);

  const errorFields = useMemo(() => {
    const allErrors = [...errors];
    if (processMessage) allErrors.push(processMessage);
    return parseErrorFields(allErrors);
  }, [errors, processMessage]);

  const stateOptions = useMemo(
    () => venezuelaLocations.map((s) => ({ label: s.estado, value: s.estado })),
    [venezuelaLocations]
  );

  const birthStateVal = Form.useWatch('birthState', form);
  const birthMunVal = Form.useWatch('birthMunicipality', form);
  const resStateVal = Form.useWatch('residenceState', form);
  const resMunVal = Form.useWatch('residenceMunicipality', form);
  Form.useWatch('representativeType', form);

  const motherStateVal = Form.useWatch(['mother', 'residenceState'], form);
  const motherMunVal = Form.useWatch(['mother', 'residenceMunicipality'], form);
  const fatherStateVal = Form.useWatch(['father', 'residenceState'], form);
  const fatherMunVal = Form.useWatch(['father', 'residenceMunicipality'], form);
  const repStateVal = Form.useWatch(['representative', 'residenceState'], form);
  const repMunVal = Form.useWatch(['representative', 'residenceMunicipality'], form);

  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);

  useEffect(() => {
    if (open && payload) {
      const values: Record<string, unknown> = { ...payload };
      if (typeof payload.birthdate === 'string' && payload.birthdate) {
        values.birthdate = dayjs(payload.birthdate as string);
      }
      if (!values.schoolPeriodId && activePeriod) {
        values.schoolPeriodId = activePeriod.id;
      }
      form.setFieldsValue(values);
      setSelectedGradeId((payload.gradeId as number) || null);
      setNameConflict(null);
    }
  }, [open, payload, form, activePeriod]);

  const getSectionsForGrade = useCallback(
    (gradeId: number | null) => {
      if (!gradeId) return [];
      return enrollStructure.find((s) => s.gradeId === gradeId)?.sections || [];
    },
    [enrollStructure]
  );

  const fp = useCallback(
    (name: string) => ({
      validateStatus: errorFields.has(name) ? ('error' as const) : undefined,
      help: errorFields.has(name) ? errorFields.get(name) : undefined
    }),
    [errorFields]
  );

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const finalPayload: Record<string, unknown> = {
        ...values,
        birthdate: values.birthdate ? (values.birthdate as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        schoolPeriodId: values.schoolPeriodId || activePeriod?.id
      };

      const result = await retrySingleRow(finalPayload, false);

      if (result.nameConflict) {
        setNameConflict(result);
        return;
      }

      if (result.success) {
        message.success(result.message);
        onSuccess(rowNumber);
        onClose();
      } else {
        message.error(result.message);
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      const apiErr = err as { response?: { data?: { message?: string } } };
      message.error(apiErr?.response?.data?.message || 'Error al reintentar la inscripción');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmNameUpdate = async () => {
    try {
      setSubmitting(true);
      const values = await form.validateFields();
      const finalPayload: Record<string, unknown> = {
        ...values,
        birthdate: values.birthdate ? (values.birthdate as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        schoolPeriodId: values.schoolPeriodId || activePeriod?.id
      };
      const result = await retrySingleRow(finalPayload, true);
      if (result.success) {
        message.success(result.message);
        setNameConflict(null);
        onSuccess(rowNumber);
        onClose();
      } else {
        message.error(result.message);
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      message.error(apiErr?.response?.data?.message || 'Error al reintentar');
    } finally {
      setSubmitting(false);
    }
  };

  const renderGuardianFields = (prefix: 'mother' | 'father' | 'representative') => {
    const prefixState =
      prefix === 'mother' ? motherStateVal : prefix === 'father' ? fatherStateVal : repStateVal;
    const prefixMun =
      prefix === 'mother' ? motherMunVal : prefix === 'father' ? fatherMunVal : repMunVal;

    const hasGroupError = errorFields.has(prefix);
    return (
      <div style={hasGroupError ? { border: '1px solid #ff4d4f', borderRadius: 8, padding: 12 } : undefined}>
        {hasGroupError && (
          <Alert type="error" message={errorFields.get(prefix)} showIcon style={{ marginBottom: 12 }} banner />
        )}
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name={[prefix, 'firstName']} label="Nombres" {...fp(`${prefix}.firstName`)}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name={[prefix, 'lastName']} label="Apellidos" {...fp(`${prefix}.lastName`)}>
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={8}>
            <Form.Item
              name={[prefix, 'documentType']}
              label="Tipo Doc."
              {...fp(`${prefix}.documentType`)}
            >
              <Select options={GUARDIAN_DOC_OPTIONS} allowClear />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item name={[prefix, 'document']} label="Documento" {...fp(`${prefix}.document`)}>
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name={[prefix, 'phone']} label="Teléfono" {...fp(`${prefix}.phone`)}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name={[prefix, 'email']} label="Correo" {...fp(`${prefix}.email`)}>
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={8}>
            <Form.Item
              name={[prefix, 'residenceState']}
              label="Estado"
              {...fp(`${prefix}.residenceState`)}
            >
              <Select
                showSearch
                optionFilterProp="label"
                filterOption={selectFilter}
                options={stateOptions}
                allowClear
                onChange={() => {
                  form.setFieldsValue({
                    [prefix]: {
                      ...form.getFieldValue(prefix),
                      residenceMunicipality: undefined,
                      residenceParish: undefined
                    }
                  });
                }}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name={[prefix, 'residenceMunicipality']}
              label="Municipio"
              {...fp(`${prefix}.residenceMunicipality`)}
            >
              <Select
                showSearch
                optionFilterProp="label"
                filterOption={selectFilter}
                options={buildMunOpts(venezuelaLocations, prefixState as string)}
                allowClear
                onChange={() => {
                  form.setFieldsValue({
                    [prefix]: {
                      ...form.getFieldValue(prefix),
                      residenceParish: undefined
                    }
                  });
                }}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name={[prefix, 'residenceParish']}
              label="Parroquia"
              {...fp(`${prefix}.residenceParish`)}
            >
              <Select
                showSearch
                optionFilterProp="label"
                filterOption={selectFilter}
                options={buildParOpts(venezuelaLocations, prefixState as string, prefixMun as string)}
                allowClear
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name={[prefix, 'address']} label="Dirección" {...fp(`${prefix}.address`)}>
          <Input />
        </Form.Item>
      </div>
    );
  };

  const allErrors = useMemo(() => {
    const list = [...errors];
    if (processMessage) list.push(processMessage);
    return list;
  }, [errors, processMessage]);

  const collapseItems = [
    {
      key: 'student',
      label: (
        <Space>
          <span>Datos del Estudiante</span>
          {(errorFields.has('firstName') || errorFields.has('lastName') || errorFields.has('document') ||
            errorFields.has('gender') || errorFields.has('birthdate')) && (
            <Tag color="error" style={{ marginLeft: 8 }}>Con errores</Tag>
          )}
        </Space>
      ),
      children: (
        <>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="firstName" label="Nombres" rules={[{ required: true }]} {...fp('firstName')}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="lastName" label="Apellidos" rules={[{ required: true }]} {...fp('lastName')}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="documentType" label="Tipo Doc." rules={[{ required: true }]}>
                <Select>
                  <Option value="Venezolano">V</Option>
                  <Option value="Extranjero">E</Option>
                  <Option value="Pasaporte">P</Option>
                  <Option value="Cedula Escolar">CE</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="document" label="Documento" {...fp('document')}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="gender" label="Género" rules={[{ required: true }]} {...fp('gender')}>
                <Radio.Group>
                  <Radio.Button value="M">M</Radio.Button>
                  <Radio.Button value="F">F</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="birthdate" label="Fecha Nacimiento" rules={[{ required: true }]} {...fp('birthdate')}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="nationality" label="Nacionalidad">
                <Select allowClear>
                  <Option value="Venezolano">Venezolano</Option>
                  <Option value="Extranjero">Extranjero</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </>
      )
    },
    {
      key: 'location',
      label: (
        <Space>
          <span>Ubicación</span>
          {(errorFields.has('birthState') || errorFields.has('birthMunicipality') || errorFields.has('birthParish') ||
            errorFields.has('residenceState') || errorFields.has('residenceMunicipality') || errorFields.has('residenceParish')) && (
            <Tag color="error" style={{ marginLeft: 8 }}>Con errores</Tag>
          )}
        </Space>
      ),
      children: (
        <>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>Nacimiento</Text>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="birthState" label="Estado" rules={[{ required: true }]} {...fp('birthState')}>
                <Select
                  showSearch optionFilterProp="label" filterOption={selectFilter}
                  options={stateOptions}
                  onChange={() => form.setFieldsValue({ birthMunicipality: undefined, birthParish: undefined })}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="birthMunicipality" label="Municipio" rules={[{ required: true }]} {...fp('birthMunicipality')}>
                <Select
                  showSearch optionFilterProp="label" filterOption={selectFilter}
                  options={buildMunOpts(venezuelaLocations, birthStateVal as string)}
                  onChange={() => form.setFieldsValue({ birthParish: undefined })}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="birthParish" label="Parroquia" rules={[{ required: true }]} {...fp('birthParish')}>
                <Select
                  showSearch optionFilterProp="label" filterOption={selectFilter}
                  options={buildParOpts(venezuelaLocations, birthStateVal as string, birthMunVal as string)}
                />
              </Form.Item>
            </Col>
          </Row>
          <Divider style={{ margin: '12px 0' }} />
          <Text strong style={{ display: 'block', marginBottom: 8 }}>Residencia</Text>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="residenceState" label="Estado" rules={[{ required: true }]} {...fp('residenceState')}>
                <Select
                  showSearch optionFilterProp="label" filterOption={selectFilter}
                  options={stateOptions}
                  onChange={() => form.setFieldsValue({ residenceMunicipality: undefined, residenceParish: undefined })}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="residenceMunicipality" label="Municipio" rules={[{ required: true }]} {...fp('residenceMunicipality')}>
                <Select
                  showSearch optionFilterProp="label" filterOption={selectFilter}
                  options={buildMunOpts(venezuelaLocations, resStateVal as string)}
                  onChange={() => form.setFieldsValue({ residenceParish: undefined })}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="residenceParish" label="Parroquia" rules={[{ required: true }]} {...fp('residenceParish')}>
                <Select
                  showSearch optionFilterProp="label" filterOption={selectFilter}
                  options={buildParOpts(venezuelaLocations, resStateVal as string, resMunVal as string)}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="address" label="Dirección">
            <Input />
          </Form.Item>
        </>
      )
    },
    {
      key: 'contact',
      label: 'Contacto',
      children: (
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="phone1" label="Teléfono 1"><Input /></Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="phone2" label="Teléfono 2"><Input /></Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="email" label="Correo"><Input /></Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="whatsapp" label="WhatsApp"><Input /></Form.Item>
          </Col>
        </Row>
      )
    },
    {
      key: 'enrollment',
      label: (
        <Space>
          <span>Datos de Inscripción</span>
          {(errorFields.has('schoolPeriodId') || errorFields.has('gradeId')) && (
            <Tag color="error" style={{ marginLeft: 8 }}>Con errores</Tag>
          )}
        </Space>
      ),
      children: (
        <>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="gradeId" label="Grado" rules={[{ required: true }]} {...fp('gradeId')}>
                <Select
                  placeholder="Seleccione"
                  onChange={(val: number) => {
                    setSelectedGradeId(val);
                    form.setFieldsValue({ sectionId: undefined });
                  }}
                >
                  {enrollStructure.map((s) => (
                    <Option key={s.gradeId} value={s.gradeId}>{s.grade?.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sectionId" label="Sección" {...fp('sectionId')}>
                <Select placeholder="Seleccione" allowClear disabled={!selectedGradeId}>
                  {getSectionsForGrade(selectedGradeId).map((sec) => (
                    <Option key={sec.id} value={sec.id}>{sec.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="escolaridad" label="Escolaridad" rules={[{ required: true }]}>
                <Select options={ESCOLARIDAD_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="representativeType" label="Quién representa" rules={[{ required: true }]}>
                <Select options={REPRESENTATIVE_TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="pathology" label="Patología"><Input /></Form.Item>
            </Col>
          </Row>
          <Form.Item name="livingWith" label="¿Con quién vive?"><Input /></Form.Item>
        </>
      )
    },
    {
      key: 'mother',
      label: (
        <Space>
          <span>Datos de la Madre</span>
          {(errorFields.has('mother') || [...errorFields.keys()].some((k) => k.startsWith('mother.'))) && (
            <Tag color="error" style={{ marginLeft: 8 }}>Con errores</Tag>
          )}
        </Space>
      ),
      children: renderGuardianFields('mother')
    },
    {
      key: 'father',
      label: (
        <Space>
          <span>Datos del Padre</span>
          {(errorFields.has('father') || [...errorFields.keys()].some((k) => k.startsWith('father.'))) && (
            <Tag color="error" style={{ marginLeft: 8 }}>Con errores</Tag>
          )}
        </Space>
      ),
      children: renderGuardianFields('father')
    },
    {
      key: 'representative',
      label: (
        <Space>
          <span>Datos del Representante</span>
          {(errorFields.has('representative') || [...errorFields.keys()].some((k) => k.startsWith('representative.'))) && (
            <Tag color="error" style={{ marginLeft: 8 }}>Con errores</Tag>
          )}
        </Space>
      ),
      children: renderGuardianFields('representative')
    }
  ];

  const defaultActiveKeys = useMemo(() => {
    const keys: string[] = [];
    if (errorFields.has('firstName') || errorFields.has('lastName') || errorFields.has('document') ||
        errorFields.has('gender') || errorFields.has('birthdate'))
      keys.push('student');
    if (errorFields.has('birthState') || errorFields.has('birthMunicipality') || errorFields.has('birthParish') ||
        errorFields.has('residenceState') || errorFields.has('residenceMunicipality') || errorFields.has('residenceParish'))
      keys.push('location');
    if (errorFields.has('schoolPeriodId') || errorFields.has('gradeId') || errorFields.has('sectionId'))
      keys.push('enrollment');
    if (errorFields.has('mother') || [...errorFields.keys()].some((k) => k.startsWith('mother.')))
      keys.push('mother');
    if (errorFields.has('father') || [...errorFields.keys()].some((k) => k.startsWith('father.')))
      keys.push('father');
    if (errorFields.has('representative') || [...errorFields.keys()].some((k) => k.startsWith('representative.')))
      keys.push('representative');

    if (keys.length === 0) keys.push('student', 'enrollment');
    return keys;
  }, [errorFields]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={`Corregir inscripción — Fila ${rowNumber}`}
      width={900}
      destroyOnClose
      footer={[
        <Button key="cancel" onClick={onClose}>Cancelar</Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit}>
          Reintentar inscripción
        </Button>
      ]}
    >
      <Form form={form} layout="vertical" size="small">
        {allErrors.length > 0 && (
          <Alert
            type="error"
            showIcon
            icon={<ExclamationCircleOutlined />}
            style={{ marginBottom: 16 }}
            message="Errores detectados"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {allErrors.map((e, i) => (
                  <li key={i} style={{ color: '#cf1322' }}>{e}</li>
                ))}
              </ul>
            }
          />
        )}

        {nameConflict && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Conflicto de nombre"
            description={
              <div>
                <p>{nameConflict.message}</p>
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckCircleOutlined />}
                    loading={submitting}
                    onClick={handleConfirmNameUpdate}
                  >
                    Sí, actualizar nombre e inscribir
                  </Button>
                  <Button size="small" onClick={() => setNameConflict(null)}>
                    No, corregir datos
                  </Button>
                </Space>
              </div>
            }
          />
        )}

        <Form.Item name="schoolPeriodId" hidden>
          <Input />
        </Form.Item>

        <Collapse
          defaultActiveKey={defaultActiveKeys}
          items={collapseItems}
          style={{ marginBottom: 16 }}
        />
      </Form>
    </Modal>
  );
};

export default BulkRetryModal;
