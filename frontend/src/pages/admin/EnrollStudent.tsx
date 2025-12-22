import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Form, Tag, message, Select, Row, Col, Input, DatePicker, Radio, Tabs, Alert } from 'antd';
import { UserAddOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Option } = Select;
const { TabPane } = Tabs;

type VenezuelaMunicipality = {
  municipio: string;
  parroquias: string[];
};

type VenezuelaState = {
  estado: string;
  municipios: VenezuelaMunicipality[];
};

const selectFilterOption = (input: string, option?: { label?: string }) =>
  (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase());

const EnrollStudent: React.FC = () => {
  // State
  const [activePeriod, setActivePeriod] = useState<any>(null);
  const [enrollStructure, setEnrollStructure] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [venezuelaLocations, setVenezuelaLocations] = useState<VenezuelaState[]>([]);

  // For section selector (controlled)
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);
  const [selectedGradeIdExisting, setSelectedGradeIdExisting] = useState<number | null>(null);

  // Existing Student State
  const [studentOptions, setStudentOptions] = useState<any[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Forms
  const [newStudentForm] = Form.useForm();
  const [existingStudentForm] = Form.useForm();
  const birthStateValue = Form.useWatch('birthState', newStudentForm);
  const birthMunicipalityValue = Form.useWatch('birthMunicipality', newStudentForm);

  // Load Active Period and its structure on mount
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        // 1. Get periods and find active
        const periodsRes = await api.get('/academic/periods');
        const active = periodsRes.data.find((p: any) => p.isActive);

        if (!active) {
          message.warning('No hay periodo escolar activo configurado');
          setLoading(false);
          return;
        }

        setActivePeriod(active);

        // 2. Load structure for active period
        const structureRes = await api.get(`/academic/structure/${active.id}`);
        setEnrollStructure(structureRes.data);

        // 3. Load venezuela locations
        const locationsRes = await api.get('/locations/venezuela');
        setVenezuelaLocations(locationsRes.data);
      } catch (error) {
        message.error('Error cargando datos del periodo activo');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Get sections for selected grade
  const getSectionsForGrade = (gradeId: number | null) => {
    if (!gradeId) return [];
    const item = enrollStructure.find(s => s.gradeId === gradeId);
    return item?.sections || [];
  };

  const stateOptions = useMemo(
    () => venezuelaLocations.map((state) => ({ label: state.estado, value: state.estado })),
    [venezuelaLocations]
  );

  const selectedBirthState = useMemo(
    () => venezuelaLocations.find((state) => state.estado === birthStateValue) || null,
    [birthStateValue, venezuelaLocations]
  );

  const municipalityOptions = useMemo(
    () =>
      selectedBirthState
        ? selectedBirthState.municipios.map((municipio) => ({
          label: municipio.municipio,
          value: municipio.municipio
        }))
        : [],
    [selectedBirthState]
  );

  const selectedMunicipality = useMemo(
    () =>
      selectedBirthState?.municipios.find((municipio) => municipio.municipio === birthMunicipalityValue) ||
      null,
    [selectedBirthState, birthMunicipalityValue]
  );

  const parishOptions = useMemo(
    () =>
      selectedMunicipality
        ? selectedMunicipality.parroquias.map((parish) => ({ label: parish, value: parish }))
        : [],
    [selectedMunicipality]
  );

  // --- Handlers ---

  const handleSearchStudents = (value: string) => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!value || value.length < 2) {
      setStudentOptions([]);
      return;
    }

    // Debounce: wait 300ms before searching
    searchTimeoutRef.current = setTimeout(async () => {
      setSearchingStudents(true);
      try {
        const res = await api.get(`/users?q=${encodeURIComponent(value)}`);
        const students = res.data.filter((p: any) =>
          p.roles?.some((r: any) => ['student', 'estudiante', 'alumno'].includes(r.name.toLowerCase()))
        );
        setStudentOptions(students.map((p: any) => ({
          label: `${p.firstName} ${p.lastName} (${p.document})`,
          value: p.id
        })));
      } catch (error) {
        console.error('Error buscando estudiantes:', error);
      } finally {
        setSearchingStudents(false);
      }
    }, 300);
  };

  // Submit: New Student
  const handleNewStudentSubmit = async (values: any) => {
    if (!activePeriod) {
      message.error('No hay periodo activo');
      return;
    }

    try {
      const payload = {
        ...values,
        schoolPeriodId: activePeriod.id,
        birthdate: values.birthdate ? values.birthdate.format('YYYY-MM-DD') : null
      };

      await api.post('/inscriptions/register', payload);

      message.success('Estudiante registrado e inscrito exitosamente');
      newStudentForm.resetFields();
      setSelectedGradeId(null);
    } catch (error: any) {
      console.error(error);
      message.error(error.response?.data?.error || error.response?.data?.message || 'Error al procesar la solicitud');
    }
  };

  // Submit: Existing Student
  const handleExistingStudentSubmit = async (values: any) => {
    if (!activePeriod) {
      message.error('No hay periodo activo');
      return;
    }

    try {
      await api.post('/inscriptions', {
        ...values,
        schoolPeriodId: activePeriod.id
      });
      message.success('Estudiante inscrito correctamente');
      existingStudentForm.resetFields();
      setSelectedGradeIdExisting(null);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error en inscripción');
    }
  };

  if (loading) {
    return <Card loading />;
  }

  if (!activePeriod) {
    return (
      <Card>
        <Alert
          type="warning"
          message="No hay periodo escolar activo"
          description="Para inscribir estudiantes, primero debe configurar un periodo escolar activo desde el módulo de Gestión Académica."
          showIcon
        />
      </Card>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
      <Card
        title="Inscripción de Estudiantes"
        bordered={false}
        extra={
          <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
            Periodo Activo: <strong>{activePeriod.name}</strong>
          </Tag>
        }
      >
        <Tabs defaultActiveKey="new">

          {/* TAB 1: NEW STUDENT */}
          <TabPane tab="Nuevo Ingreso (Registrar e Inscribir)" key="new">
            <Form
              form={newStudentForm}
              layout="vertical"
              onFinish={handleNewStudentSubmit}
              initialValues={{ documentType: 'Venezolano', gender: 'M' }}
            >
              <div style={{ background: '#f0f7ff', padding: 16, borderRadius: 8, marginBottom: 24, border: '1px solid #91caff' }}>
                <h4 style={{ marginTop: 0, color: '#1890ff' }}>1. Datos Académicos</h4>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="gradeId"
                      label="Grado"
                      rules={[{ required: true, message: 'Seleccione un grado' }]}
                    >
                      <Select
                        placeholder="Seleccione Grado"
                        onChange={(val) => {
                          setSelectedGradeId(val);
                          newStudentForm.setFieldsValue({ sectionId: undefined });
                        }}
                      >
                        {enrollStructure.map(s => (
                          <Option key={s.gradeId} value={s.gradeId}>{s.grade?.name}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="sectionId"
                      label="Sección (Opcional)"
                    >
                      <Select
                        placeholder="Seleccione Sección"
                        disabled={!selectedGradeId}
                        allowClear
                      >
                        {getSectionsForGrade(selectedGradeId).map((sec: any) => (
                          <Option key={sec.id} value={sec.id}>{sec.name}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#666', borderBottom: '1px solid #eee', paddingBottom: 8 }}>2. Datos del Estudiante</h4>

                <Row gutter={16}>
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

                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="documentType" label="Tipo Doc" rules={[{ required: true }]}>
                      <Select>
                        <Option value="Venezolano">V</Option>
                        <Option value="Extranjero">E</Option>
                        <Option value="Pasaporte">P</Option>
                        <Option value="Cedula Escolar">CE</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={16}>
                    <Form.Item name="document" label="Documento" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="gender" label="Género" rules={[{ required: true }]}>
                      <Radio.Group>
                        <Radio value="M">Masculino</Radio>
                        <Radio value="F">Femenino</Radio>
                      </Radio.Group>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="birthdate" label="Fecha Nacimiento" rules={[{ required: true }]}>
                      <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#666', borderBottom: '1px solid #eee', paddingBottom: 8 }}>3. Datos de Nacimiento</h4>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name="birthState"
                      label="Estado de nacimiento"
                      rules={[{ required: true, message: 'Seleccione un estado' }]}
                    >
                      <Select
                        placeholder="Seleccione estado"
                        showSearch
                        optionFilterProp="label"
                        filterOption={selectFilterOption}
                        options={stateOptions}
                        onChange={() => newStudentForm.setFieldsValue({
                          birthMunicipality: undefined,
                          birthParish: undefined
                        })}
                        disabled={!stateOptions.length}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="birthMunicipality"
                      label="Municipio de nacimiento"
                      rules={[{ required: true, message: 'Seleccione un municipio' }]}
                    >
                      <Select
                        placeholder="Seleccione municipio"
                        showSearch
                        optionFilterProp="label"
                        filterOption={selectFilterOption}
                        options={municipalityOptions}
                        disabled={!birthStateValue}
                        onChange={() => newStudentForm.setFieldsValue({ birthParish: undefined })}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="birthParish"
                      label="Parroquia de nacimiento"
                      rules={[{ required: true, message: 'Seleccione una parroquia' }]}
                    >
                      <Select
                        placeholder="Seleccione parroquia"
                        showSearch
                        optionFilterProp="label"
                        filterOption={selectFilterOption}
                        options={parishOptions}
                        disabled={!birthMunicipalityValue}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              <div>
                <h4 style={{ color: '#666', borderBottom: '1px solid #eee', paddingBottom: 8 }}>4. Datos de Contacto</h4>
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item name="address" label="Dirección" rules={[{ required: true }]}>
                      <Input.TextArea rows={2} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="phone1" label="Teléfono Principal">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              <Form.Item style={{ marginTop: 24 }}>
                <Button type="primary" htmlType="submit" block size="large" icon={<UserAddOutlined />}>
                  Registrar e Inscribir Estudiante
                </Button>
                <div style={{ marginTop: 8, color: '#888', fontSize: 12, textAlign: 'center' }}>
                  * Los estudiantes no requieren usuario y contraseña
                </div>
              </Form.Item>
            </Form>
          </TabPane>

          {/* TAB 2: EXISTING STUDENT */}
          <TabPane tab="Estudiante Regular (Ya Registrado)" key="existing">
            <Form
              form={existingStudentForm}
              layout="vertical"
              onFinish={handleExistingStudentSubmit}
              style={{ maxWidth: 600, margin: '20px auto' }}
            >
              <Form.Item
                name="personId"
                label="Estudiante (escriba al menos 2 caracteres para buscar)"
                rules={[{ required: true, message: 'Busque y seleccione un estudiante' }]}
              >
                <Select
                  showSearch
                  placeholder="Escriba nombre o cédula..."
                  filterOption={false}
                  onSearch={handleSearchStudents}
                  loading={searchingStudents}
                  options={studentOptions}
                  notFoundContent={
                    searchingStudents
                      ? <div style={{ padding: 8 }}>Buscando...</div>
                      : studentOptions.length === 0
                        ? <div style={{ padding: 8, color: '#999' }}>Escriba para buscar estudiantes</div>
                        : null
                  }
                />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="gradeId"
                    label="Grado"
                    rules={[{ required: true, message: 'Seleccione un grado' }]}
                  >
                    <Select
                      placeholder="Seleccione Grado"
                      onChange={(val) => {
                        setSelectedGradeIdExisting(val);
                        existingStudentForm.setFieldsValue({ sectionId: undefined });
                      }}
                    >
                      {enrollStructure.map(s => (
                        <Option key={s.gradeId} value={s.gradeId}>{s.grade?.name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="sectionId"
                    label="Sección (Opcional)"
                  >
                    <Select
                      placeholder="Seleccione Sección"
                      disabled={!selectedGradeIdExisting}
                      allowClear
                    >
                      {getSectionsForGrade(selectedGradeIdExisting).map((sec: any) => (
                        <Option key={sec.id} value={sec.id}>{sec.name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item>
                <Button type="primary" htmlType="submit" block icon={<UserAddOutlined />}>
                  Inscribir Estudiante
                </Button>
              </Form.Item>
            </Form>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default EnrollStudent;
