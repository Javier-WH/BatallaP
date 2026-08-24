import React, { useEffect, useMemo } from 'react';
import { Modal, Form, Input, Select, Row, Col, Radio, DatePicker, Divider, Tabs } from 'antd';
import dayjs from 'dayjs';

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
}

const DOCUMENT_TYPES = [
  { value: 'Venezolano', label: 'Venezolano' },
  { value: 'Extranjero', label: 'Extranjero' },
  { value: 'Pasaporte', label: 'Pasaporte' },
  { value: 'Cedula Escolar', label: 'Cédula Escolar' },
];

const GUARDIAN_DOC_TYPES = [
  { value: 'Venezolano', label: 'Venezolano' },
  { value: 'Extranjero', label: 'Extranjero' },
  { value: 'Pasaporte', label: 'Pasaporte' },
];

const REP_TYPES = [
  { value: 'mother', label: 'La Madre' },
  { value: 'father', label: 'El Padre' },
  { value: 'sibling', label: 'Hermano/a' },
  { value: 'grandparent', label: 'Abuelo/a' },
  { value: 'uncle_aunt', label: 'Tío/a' },
  { value: 'other', label: 'Otra persona' },
];

const PHONE_RULE = { pattern: /^(04|02)\d{2}-\d{7}$/, message: 'Formato: 04XX-XXXXXXX' };

interface GuardianFieldsProps {
  prefix: 'mother' | 'father' | 'representative';
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
        <Col span={8}>
          <Form.Item name={[prefix, 'documentType']} label="Tipo Doc">
            <Select options={GUARDIAN_DOC_TYPES} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name={[prefix, 'document']} label="Cédula" rules={required ? [{ required: true, message: 'Requerido' }] : []}>
            <Input />
          </Form.Item>
        </Col>
        <Col span={8}>
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
            <Input />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name={[prefix, 'phone2']} label="Teléfono secundario" rules={[PHONE_RULE]}>
            <Input placeholder="Opcional" />
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
      form.setFieldsValue({
        ...initialData,
        birthdate: initialData.birthdate || undefined,
        mother: initialData.mother || undefined,
        father: initialData.father || undefined,
        representative: initialData.representative || undefined,
      });
    }
  }, [visible, initialData, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload: Partial<EditStudentData> = {
        ...values,
        birthdate: values.birthdate ? (values.birthdate as dayjs.Dayjs) : null,
      };
      onSave(payload);
    } catch {
      // validation errors are shown by the form
    }
  };

  const motherRequired = repType === 'mother';
  const fatherRequired = repType === 'father';
  const representativeRequired = repType === 'other' || repType === 'sibling' || repType === 'grandparent' || repType === 'uncle_aunt';

  return (
    <Modal
      open={visible}
      onCancel={onCancel}
      onOk={handleSave}
      title={`Editar estudiante — ${studentName}`}
      width={900}
      okText="Guardar"
      cancelText="Cancelar"
      destroyOnClose
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
                    <Col span={6}>
                      <Form.Item name="documentType" label="Tipo Doc" rules={[{ required: true }]}>
                        <Select options={DOCUMENT_TYPES} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="document" label="Cédula / Documento">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item name="gender" label="Género">
                        <Select>
                          <Select.Option value="M">Masculino</Select.Option>
                          <Select.Option value="F">Femenino</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={6}>
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
                    <Col span={12}>
                      <Form.Item name="pathology" label="Patología">
                        <Input placeholder="Opcional" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="livingWith" label="Vive con">
                        <Input placeholder="Opcional" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Divider orientation="left" plain>Residencia</Divider>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item name="residenceState" label="Estado">
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
                  <Form.Item name="representativeType" label="Representante legal">
                    <Radio.Group>
                      {REP_TYPES.map(r => <Radio.Button key={r.value} value={r.value}>{r.label}</Radio.Button>)}
                    </Radio.Group>
                  </Form.Item>
                  <Divider orientation="left" plain>Datos de la Madre {motherRequired ? '(Obligatorio)' : '(Opcional)'}</Divider>
                  <GuardianFields prefix="mother" required={motherRequired} locations={locations} />
                  <Divider orientation="left" plain>Datos del Padre {fatherRequired ? '(Obligatorio)' : '(Opcional)'}</Divider>
                  <GuardianFields prefix="father" required={fatherRequired} locations={locations} />
                  {representativeRequired && (
                    <>
                      <Divider orientation="left" plain>Datos del Representante (Obligatorio)</Divider>
                      <GuardianFields prefix="representative" required={true} locations={locations} />
                    </>
                  )}
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
