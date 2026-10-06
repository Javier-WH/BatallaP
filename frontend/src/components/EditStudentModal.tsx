import React, { useEffect, useMemo } from 'react';
import { Modal, Form, Input, Select, Row, Col, Radio, DatePicker, Tabs, Checkbox, Collapse } from 'antd';
import dayjs from 'dayjs';
import DocumentField from '@/components/shared/DocumentField';
import PhoneInput from '@/components/shared/PhoneInput';
import {
  DOCUMENT_TYPE_OPTIONS,
  GUARDIAN_DOCUMENT_TYPE_OPTIONS,
  formatPhoneInput,
  guardianHasPersonData,
  sameGuardianPerson,
} from '@/utils/personFields';

export interface EditStudentGuardian {
  id?: number;
  firstName?: string;
  lastName?: string;
  documentType?: string;
  document?: string;
  phone?: string;
  phone2?: string;
  whatsapp?: string;
  email?: string;
  residenceState?: string;
  residenceMunicipality?: string;
  residenceParish?: string;
  address?: string;
  occupation?: string;
  birthdate?: string | null;
}

export interface EditStudentDocuments {
  receivedPartidaNacimiento?: boolean;
  receivedCopiaCedulaEstudiante?: boolean;
  receivedCopiaCedulaRepresentante?: boolean;
  receivedNotasCertificadas?: boolean;
  receivedCertificadoAprendizaje?: boolean;
  receivedCartaBuenaConducta?: boolean;
  receivedInformesMedicos?: boolean;
  receivedFotoCarnetEstudiante?: boolean;
}

export interface EditStudentData {
  id: number;
  firstName: string;
  lastName: string;
  documentType: string;
  document: string;
  gender?: string;
  birthdate: dayjs.Dayjs | null;
  birthState?: string;
  birthMunicipality?: string;
  birthParish?: string;
  residenceState?: string;
  residenceMunicipality?: string;
  residenceParish?: string;
  address?: string;
  pathology?: string;
  livingWith?: string;
  phone1?: string;
  whatsapp?: string;
  email?: string;
  escolaridad?: string;
  mother?: EditStudentGuardian | null;
  father?: EditStudentGuardian | null;
  representative?: EditStudentGuardian | null;
  representativeType?: string;
  documents?: EditStudentDocuments | null;
}

export interface VenezuelaLocation {
  estado: string;
  municipios: { municipio: string; parroquias: string[] }[];
}

interface EditStudentModalProps {
  visible: boolean;
  onCancel: () => void;
  onSave: (data: Partial<EditStudentData>) => void;
  studentName: string;
  initialData: EditStudentData | null;
  locations: VenezuelaLocation[];
  /** When false, the documents tab is shown disabled (row has no matriculation to attach the checklist to). */
  documentsDisabled?: boolean;
}

const REP_TYPES = [
  { value: 'mother', label: 'La Madre' },
  { value: 'father', label: 'El Padre' },
  { value: 'sibling', label: 'Hermano/a' },
  { value: 'grandparent', label: 'Abuelo/a' },
  { value: 'uncle_aunt', label: 'Tío/a' },
  { value: 'other', label: 'Otra persona' },
];

const PARENT_KEYS = ['mother', 'father'] as const;
type GuardianBucket = 'mother' | 'father' | 'representative';

const PHONE_RULE = { pattern: /^(04|02)\d{2}-\d{7}$/, message: 'Formato: 04XX-XXXXXXX' };

/** Which guardian bucket stores the representative's data for a given vínculo. */
const bucketOf = (type?: string): GuardianBucket =>
  type === 'mother' || type === 'father' ? type : 'representative';

const guardianLabel: Record<GuardianBucket, string> = {
  mother: 'La Madre',
  father: 'El Padre',
  representative: 'el representante',
};

const personName = (g?: EditStudentGuardian | null) =>
  `${g?.firstName ?? ''} ${g?.lastName ?? ''}`.trim() || 'la persona registrada';

interface GuardianFieldsProps {
  prefix: GuardianBucket;
  required: boolean;
  locations: VenezuelaLocation[];
}

const GuardianFields: React.FC<GuardianFieldsProps> = ({ prefix, required, locations }) => {
  const form = Form.useFormInstance();
  const stateValue = Form.useWatch([prefix, 'residenceState'], form);
  const munValue = Form.useWatch([prefix, 'residenceMunicipality'], form);

  const stateOptions = useMemo(() => locations.map(l => ({ value: l.estado, label: l.estado })), [locations]);
  const municipalityOptions = useMemo(() => {
    if (!stateValue) return [];
    const stateObj = locations.find(l => l.estado === stateValue);
    if (!stateObj) return [];
    return stateObj.municipios.map(m => ({ value: m.municipio, label: m.municipio }));
  }, [stateValue, locations]);
  const parishOptions = useMemo(() => {
    if (!stateValue || !munValue) return [];
    const stateObj = locations.find(l => l.estado === stateValue);
    if (!stateObj) return [];
    const munObj = stateObj.municipios.find(m => m.municipio === munValue);
    if (!munObj) return [];
    return munObj.parroquias.map(p => ({ value: p, label: p }));
  }, [stateValue, munValue, locations]);

  return (
    <>
      <Row gutter={12}>
        <Col span={12}>
          <Form.Item name={[prefix, 'firstName']} label="Nombres" rules={required ? [{ required: true, message: 'Requerido' }] : []}>
            <Input />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name={[prefix, 'lastName']} label="Apellidos" rules={required ? [{ required: true, message: 'Requerido' }] : []}>
            <Input />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={12}>
        <Col span={10}>
          <DocumentField
            label="Documento"
            required={required}
            typeName={[prefix, 'documentType']}
            numberName={[prefix, 'document']}
            typeOptions={GUARDIAN_DOCUMENT_TYPE_OPTIONS}
            typeRules={required ? [{ required: true, message: 'Requerido' }] : []}
            numberRules={required ? [{ required: true, message: 'Requerido' }] : []}
            allowClearType={!required}
          />
        </Col>
        <Col span={7}>
          <Form.Item name={[prefix, 'birthdate']} label="Fecha de nacimiento">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
        </Col>
        <Col span={7}>
          <Form.Item name={[prefix, 'occupation']} label="Ocupación">
            <Input />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={12}>
        <Col span={8}>
          <Form.Item
            name={[prefix, 'whatsapp']}
            label="WhatsApp / Teléfono"
            rules={required ? [{ required: true, message: 'Requerido' }, PHONE_RULE] : [PHONE_RULE]}
          >
            <PhoneInput />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name={[prefix, 'phone2']} label="Teléfono secundario" normalize={formatPhoneInput} rules={[PHONE_RULE]}>
            <Input placeholder="Opcional (cualquier código)" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name={[prefix, 'email']} label="Email" rules={[{ type: 'email' }]}>
            <Input placeholder="Opcional" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name={[prefix, 'address']} label="Dirección">
        <Input.TextArea rows={2} />
      </Form.Item>
      <Row gutter={12}>
        <Col span={8}>
          <Form.Item name={[prefix, 'residenceState']} label="Estado" rules={required ? [{ required: true }] : []}>
            <Select
              showSearch
              options={stateOptions}
              onChange={() => {
                form.setFieldValue([prefix, 'residenceMunicipality'], undefined);
                form.setFieldValue([prefix, 'residenceParish'], undefined);
              }}
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name={[prefix, 'residenceMunicipality']} label="Municipio" rules={required ? [{ required: true }] : []}>
            <Select
              showSearch
              options={municipalityOptions}
              disabled={!stateValue}
              onChange={() => form.setFieldValue([prefix, 'residenceParish'], undefined)}
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name={[prefix, 'residenceParish']} label="Parroquia" rules={required ? [{ required: true }] : []}>
            <Select showSearch options={parishOptions} disabled={!munValue} />
          </Form.Item>
        </Col>
      </Row>
    </>
  );
};

const EditStudentModal: React.FC<EditStudentModalProps> = ({
  visible,
  onCancel,
  onSave,
  studentName,
  initialData,
  locations,
  documentsDisabled = false,
}) => {
  const [form] = Form.useForm();

  const stateOptions = useMemo(() => locations.map(l => ({ value: l.estado, label: l.estado })), [locations]);

  const repType = Form.useWatch('representativeType', form);
  const birthStateValue = Form.useWatch('birthState', form);
  const birthMunValue = Form.useWatch('birthMunicipality', form);
  const resStateValue = Form.useWatch('residenceState', form);
  const resMunValue = Form.useWatch('residenceMunicipality', form);

  const birthMunOptions = useMemo(() => {
    if (!birthStateValue) return [];
    const s = locations.find(l => l.estado === birthStateValue);
    return s ? s.municipios.map(m => ({ value: m.municipio, label: m.municipio })) : [];
  }, [birthStateValue, locations]);
  const birthParishOptions = useMemo(() => {
    if (!birthStateValue || !birthMunValue) return [];
    const s = locations.find(l => l.estado === birthStateValue);
    if (!s) return [];
    const m = s.municipios.find(mu => mu.municipio === birthMunValue);
    return m ? m.parroquias.map(p => ({ value: p, label: p })) : [];
  }, [birthStateValue, birthMunValue, locations]);
  const resMunOptions = useMemo(() => {
    if (!resStateValue) return [];
    const s = locations.find(l => l.estado === resStateValue);
    return s ? s.municipios.map(m => ({ value: m.municipio, label: m.municipio })) : [];
  }, [resStateValue, locations]);
  const resParishOptions = useMemo(() => {
    if (!resStateValue || !resMunValue) return [];
    const s = locations.find(l => l.estado === resStateValue);
    if (!s) return [];
    const m = s.municipios.find(mu => mu.municipio === resMunValue);
    return m ? m.parroquias.map(p => ({ value: p, label: p })) : [];
  }, [resStateValue, resMunValue, locations]);

  useEffect(() => {
    if (visible && initialData) {
      const toGuardian = (g?: EditStudentGuardian | null) =>
        g ? { ...g, birthdate: g.birthdate ? dayjs(g.birthdate) : undefined } : undefined;
      form.setFieldsValue({
        ...initialData,
        birthdate: initialData.birthdate || undefined,
        mother: toGuardian(initialData.mother),
        father: toGuardian(initialData.father),
        representative: toGuardian(initialData.representative),
      });
    }
  }, [visible, initialData, form]);

  // When the vínculo moves between the generic "representative" bucket and a
  // parent bucket, the current representative's data travels with it (the same
  // person keeps being the rep under the new label). If the destination already
  // holds a different person, ask before overwriting.
  const handleRepTypeChange = (newType: string) => {
    const sourceKey = bucketOf(repType);
    const targetKey = bucketOf(newType);
    if (sourceKey === targetKey) return;
    // Madre ↔ Padre are different real people: the vínculo just repoints.
    if (sourceKey !== 'representative' && targetKey !== 'representative') return;

    const source = form.getFieldValue(sourceKey) as EditStudentGuardian | undefined;
    if (!guardianHasPersonData(source)) return;

    const target = form.getFieldValue(targetKey) as EditStudentGuardian | undefined;
    if (!guardianHasPersonData(target) || sameGuardianPerson(source, target)) {
      form.setFieldValue(targetKey, { ...(target ?? {}), ...source });
      return;
    }
    Modal.confirm({
      title: 'Reemplazar datos',
      content:
        `El campo de ${guardianLabel[targetKey]} ya tiene datos de ${personName(target)}. ` +
        `¿Reemplazarlos con los de ${personName(source)}?`,
      okText: 'Reemplazar',
      cancelText: 'Conservar existentes',
      onOk: () => form.setFieldValue(targetKey, { ...source }),
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const fromGuardian = (g?: EditStudentGuardian | null): EditStudentGuardian | null | undefined =>
        g ? { ...g, birthdate: g.birthdate ? dayjs(g.birthdate as dayjs.ConfigType).format('YYYY-MM-DD') : null } : g;
      // The backend always links the generic `representative` payload as the
      // legal representative; when a parent is the rep the bucket must not be
      // sent or a phantom second representative link would be created.
      const parentIsRep = values.representativeType === 'mother' || values.representativeType === 'father';
      const payload: Partial<EditStudentData> = {
        ...values,
        birthdate: values.birthdate ? (values.birthdate as dayjs.Dayjs) : null,
        mother: fromGuardian(values.mother),
        father: fromGuardian(values.father),
        representative: parentIsRep ? null : fromGuardian(values.representative),
      };
      onSave(payload);
    } catch {
      // validation errors are shown by the form
    }
  };

  const handleCancel = () => {
    if (!form.isFieldsTouched()) {
      onCancel();
      return;
    }
    Modal.confirm({
      title: 'Descartar cambios',
      content: 'Hay datos modificados sin guardar. ¿Cerrar y perderlos?',
      okText: 'Descartar',
      okType: 'danger',
      cancelText: 'Seguir editando',
      onOk: onCancel,
    });
  };

  const repBucket = bucketOf(repType);
  const repCardTitle = repType === 'mother'
    ? 'Datos de la Madre'
    : repType === 'father'
      ? 'Datos del Padre'
      : 'Datos del Representante';
  const repTypeLabel = REP_TYPES.find(r => r.value === repType)?.label;

  return (
    <Modal
      open={visible}
      onCancel={handleCancel}
      onOk={handleSave}
      title={`Editar estudiante — ${studentName}`}
      width={900}
      okText="Guardar"
      cancelText="Cancelar"
      destroyOnClose
      maskClosable={false}
    >
      <Form form={form} layout="vertical" size="small">
        <Tabs
          defaultActiveKey="student"
          items={[
            {
              key: 'student',
              label: 'Estudiante',
              children: (
                <>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="firstName" label="Nombres" rules={[{ required: true }]}>
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="lastName" label="Apellidos" rules={[{ required: true }]}>
                        <Input />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={10}>
                      <DocumentField
                        label="Documento"
                        required
                        typeName="documentType"
                        numberName="document"
                        typeOptions={DOCUMENT_TYPE_OPTIONS}
                        typeRules={[{ required: true, message: 'Requerido' }]}
                      />
                    </Col>
                    <Col span={7}>
                      <Form.Item name="gender" label="Género">
                        <Select>
                          <Select.Option value="M">Masculino</Select.Option>
                          <Select.Option value="F">Femenino</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={7}>
                      <Form.Item name="birthdate" label="Fecha de nacimiento">
                        <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={6}>
                      <Form.Item name="birthState" label="Estado de nacimiento">
                        <Select
                          showSearch
                          options={stateOptions}
                          onChange={() => {
                            form.setFieldValue('birthMunicipality', undefined);
                            form.setFieldValue('birthParish', undefined);
                          }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="birthMunicipality" label="Municipio de nacimiento">
                        <Select
                          showSearch
                          options={birthMunOptions}
                          disabled={!birthStateValue}
                          onChange={() => form.setFieldValue('birthParish', undefined)}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="birthParish" label="Parroquia de nacimiento">
                        <Select showSearch options={birthParishOptions} disabled={!birthMunValue} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="escolaridad" label="Escolaridad">
                        <Select>
                          <Select.Option value="regular">Regular</Select.Option>
                          <Select.Option value="repitiente">Repitiente</Select.Option>
                          <Select.Option value="materia_pendiente">Materia Pendiente</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item name="pathology" label="Patología">
                        <Input placeholder="Opcional" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="livingWith" label="Vive con">
                        <Input placeholder="Opcional" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="email" label="Correo electrónico" rules={[{ type: 'email' }]}>
                        <Input placeholder="Opcional" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item name="residenceState" label="Estado de residencia">
                        <Select
                          showSearch
                          options={stateOptions}
                          onChange={() => {
                            form.setFieldValue('residenceMunicipality', undefined);
                            form.setFieldValue('residenceParish', undefined);
                          }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="residenceMunicipality" label="Municipio">
                        <Select
                          showSearch
                          options={resMunOptions}
                          disabled={!resStateValue}
                          onChange={() => form.setFieldValue('residenceParish', undefined)}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="residenceParish" label="Parroquia">
                        <Select showSearch options={resParishOptions} disabled={!resMunValue} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="address" label="Dirección">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                </>
              ),
            },
            {
              key: 'guardians',
              label: 'Representantes',
              children: (
                <>
                  <Form.Item
                    name="representativeType"
                    label="¿Quién ejerce la representación?"
                    rules={[{ required: true, message: 'Seleccione el representante' }]}
                  >
                    <Radio.Group buttonStyle="solid" onChange={(e) => handleRepTypeChange(e.target.value)}>
                      {REP_TYPES.map(r => <Radio.Button key={r.value} value={r.value}>{r.label}</Radio.Button>)}
                    </Radio.Group>
                  </Form.Item>

                  {/* The selected representative's card, first and required — same
                      pattern as the enrollment form. */}
                  <div style={{
                    background: '#fff7e6',
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 16,
                    border: '1px solid #ffd591',
                  }}>
                    <h4 style={{ color: '#d46b08', marginTop: 0, marginBottom: 16 }}>
                      {repCardTitle}{repTypeLabel && repBucket === 'representative' ? ` (${repTypeLabel})` : ''} (Obligatorio)
                    </h4>
                    <GuardianFields prefix={repBucket} required locations={locations} />
                  </div>

                  {/* The other parent stays editable in a closed accordion, like
                      enrollment. The generic "representative" bucket only exists
                      when the rep is a non-parent, so it never appears here. */}
                  <Collapse
                    items={PARENT_KEYS.filter(k => k !== repBucket).map(k => ({
                      key: k,
                      label: `${k === 'mother' ? 'Datos de la Madre' : 'Datos del Padre'} (Opcional)`,
                      children: <GuardianFields prefix={k} required={false} locations={locations} />,
                    }))}
                  />
                </>
              ),
            },
            {
              key: 'documents',
              label: 'Documentos',
              children: documentsDisabled ? (
                <p style={{ color: '#888' }}>
                  Este estudiante no tiene una matrícula asociada; no se puede registrar el checklist de documentos.
                </p>
              ) : (
                <>
                  {([
                    ['receivedPartidaNacimiento', 'Partida de nacimiento'],
                    ['receivedCopiaCedulaEstudiante', 'Fotocopia de cédula del estudiante'],
                    ['receivedCopiaCedulaRepresentante', 'Fotocopia de cédula del representante'],
                    ['receivedNotasCertificadas', 'Notas certificadas (2do año en adelante)'],
                    ['receivedCertificadoAprendizaje', 'Certificado de aprendizaje'],
                    ['receivedCartaBuenaConducta', 'Carta de buena conducta'],
                    ['receivedInformesMedicos', 'Informes médicos'],
                    ['receivedFotoCarnetEstudiante', 'Foto carné del estudiante'],
                  ] as [keyof EditStudentDocuments, string][]).map(([key, label]) => (
                    <Form.Item key={key} name={['documents', key]} valuePropName="checked" style={{ marginBottom: 8 }}>
                      <Checkbox>{label}</Checkbox>
                    </Form.Item>
                  ))}
                </>
              ),
            },
          ]}
        />
      </Form>
    </Modal>
  );
};

export default EditStudentModal;
