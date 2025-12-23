import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  message,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography
} from 'antd';
import { ReloadOutlined, SearchOutlined, UserAddOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import api from '@/services/api';

const { Text } = Typography;
const { Option } = Select;

interface GradeSummary {
  id: number;
  name: string;
}

interface SectionSummary {
  id: number;
  name: string;
}

interface SchoolPeriodSummary {
  id: number;
  name: string;
}

interface PersonSummary {
  id: number;
  firstName: string;
  lastName: string;
  document?: string | null;
  documentType?: string;
  gender?: 'M' | 'F';
  birthdate?: string | null;
}

interface MatriculationSummary {
  id: number;
  grade?: GradeSummary;
  section?: SectionSummary | null;
  period?: SchoolPeriodSummary;
  student: PersonSummary;
  createdAt: string;
}

interface ContactInfo {
  phone1?: string | null;
  phone2?: string | null;
  email?: string | null;
  address?: string | null;
  whatsapp?: string | null;
}

interface ResidenceInfo {
  birthState?: string | null;
  birthMunicipality?: string | null;
  birthParish?: string | null;
  residenceState?: string | null;
  residenceMunicipality?: string | null;
  residenceParish?: string | null;
}

type GuardianRelationship = 'mother' | 'father' | 'representative';

interface GuardianInfo {
  id: number;
  relationship: GuardianRelationship;
  isRepresentative: boolean;
  firstName: string;
  lastName: string;
  document: string;
  phone?: string | null;
  email?: string | null;
  residenceState?: string | null;
  residenceMunicipality?: string | null;
  residenceParish?: string | null;
  address?: string | null;
}

interface MatriculationDetail extends MatriculationSummary {
  gradeId: number;
  sectionId?: number | null;
  schoolPeriodId: number;
  student: PersonSummary & {
    contact?: ContactInfo | null;
    residence?: ResidenceInfo | null;
  };
  guardians?: GuardianInfo[];
}

type VenezuelaMunicipality = {
  municipio: string;
  parroquias: string[];
};

type VenezuelaState = {
  estado: string;
  municipios: VenezuelaMunicipality[];
};

type EnrollStructureEntry = {
  gradeId: number;
  grade?: GradeSummary;
  sections?: SectionSummary[];
}

interface GuardianFormValues {
  firstName?: string;
  lastName?: string;
  document?: string;
  phone?: string;
  email?: string;
  residenceState?: string;
  residenceMunicipality?: string;
  residenceParish?: string;
  address?: string;
}

type RepresentativeType = 'mother' | 'father' | 'other';

interface MatriculationFormValues {
  gradeId: number;
  sectionId?: number;
  firstName: string;
  lastName: string;
  documentType: string;
  document?: string;
  gender: 'M' | 'F';
  birthdate?: Dayjs;
  birthState: string;
  birthMunicipality: string;
  birthParish: string;
  residenceState: string;
  residenceMunicipality: string;
  residenceParish: string;
  address: string;
  phone1: string;
  phone2?: string;
  email?: string;
  whatsapp?: string;
  representativeType: RepresentativeType;
  mother: GuardianFormValues;
  father?: GuardianFormValues;
  representative?: GuardianFormValues;
  previousSchoolIds?: number[];
}

type SchoolSearchResult = {
  code?: string;
  name: string;
  state: string;
};

const selectFilterOption = (input: string, option?: { label?: string }) =>
  (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase());

const buildMunicipalityOptions = (
  locations: VenezuelaState[],
  stateName?: string | null
) => {
  if (!stateName) return [];
  const selected = locations.find((state) => state.estado === stateName);
  return selected
    ? selected.municipios.map((municipio) => ({
        label: municipio.municipio,
        value: municipio.municipio
      }))
    : [];
};

const buildParishOptions = (
  locations: VenezuelaState[],
  stateName?: string | null,
  municipalityName?: string | null
) => {
  if (!stateName || !municipalityName) return [];
  const selectedState = locations.find((state) => state.estado === stateName);
  const selectedMunicipality = selectedState?.municipios.find(
    (municipio) => municipio.municipio === municipalityName
  );
  return selectedMunicipality
    ? selectedMunicipality.parroquias.map((parish) => ({ label: parish, value: parish }))
    : [];
};

const MatriculationEnrollment: React.FC = () => {
  const [matriculations, setMatriculations] = useState<MatriculationSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<MatriculationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [structure, setStructure] = useState<EnrollStructureEntry[]>([]);
  const [locations, setLocations] = useState<VenezuelaState[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Previous schools state
  const [previousSchoolsLoading, setPreviousSchoolsLoading] = useState(false);
  const [schoolOptions, setSchoolOptions] = useState<{ label: string; value: string }[]>([]);

  // Form watchers
  const birthStateValue = Form.useWatch('birthState', form);
  const birthMunicipalityValue = Form.useWatch('birthMunicipality', form);
  const residenceStateValue = Form.useWatch('residenceState', form);
  const residenceMunicipalityValue = Form.useWatch('residenceMunicipality', form);
  const motherStateValue = Form.useWatch(['mother', 'residenceState'], form);
  const motherMunicipalityValue = Form.useWatch(['mother', 'residenceMunicipality'], form);
  const fatherStateValue = Form.useWatch(['father', 'residenceState'], form);
  const fatherMunicipalityValue = Form.useWatch(['father', 'residenceMunicipality'], form);
  const representativeStateValue = Form.useWatch(['representative', 'residenceState'], form);
  const representativeMunicipalityValue = Form.useWatch(['representative', 'residenceMunicipality'], form);
  const representativeTypeValue = Form.useWatch('representativeType', form) as RepresentativeType | undefined;
  const gradeIdValue = Form.useWatch('gradeId', form) as number | null;

  const fetchMatriculations = useCallback(
    async (query?: string) => {
      setListLoading(true);
      try {
        const params = new URLSearchParams({ status: 'pending' });
        if (query) params.append('q', query);
        const { data } = await api.get(`/matriculations?${params.toString()}`);
        setMatriculations(data);
        if (data.length === 0) {
          setSelectedId(null);
          setDetail(null);
        }
      } catch (error) {
        console.error(error);
        message.error('Error cargando matriculados');
      } finally {
        setListLoading(false);
      }
    },
    []
  );

  const fetchLocations = useCallback(async () => {
    try {
      const res = await api.get('/locations/venezuela');
      setLocations(res.data || []);
    } catch (error) {
      console.error('Error loading locations:', error);
      message.error('No se pudieron cargar las ubicaciones');
    }
  }, []);

  const fetchStructure = useCallback(async (periodId: number) => {
    try {
      const res = await api.get(`/academic/structure/${periodId}`);
      setStructure(res.data || []);
    } catch (error) {
      console.error('Error loading structure:', error);
      setStructure([]);
    }
  }, []);

  const searchSchools = async (query: string) => {
    if (!query || query.length < 2) {
      setSchoolOptions([]);
      return;
    }

    setPreviousSchoolsLoading(true);
    try {
      const response = await api.get(`/planteles/search?q=${encodeURIComponent(query)}`);
      const options = response.data.map((school: SchoolSearchResult) => ({
        label: `${school.name} (${school.code})`,
        value: school.code || school.name
      }));
      setSchoolOptions(options);
    } catch (error) {
      console.error('Error searching schools:', error);
      message.error('Error buscando planteles');
    } finally {
      setPreviousSchoolsLoading(false);
    }
  };

  const loadDetail = useCallback(
    async (id: number) => {
      setDetailLoading(true);
      try {
        const { data } = await api.get(`/matriculations/${id}`);
        setDetail(data);
        await fetchStructure(data.schoolPeriodId);
        // No longer need to load previous schools - search is done on demand

        const guardians = data.guardians || [];
        const mother = guardians.find((g: GuardianInfo) => g.relationship === 'mother');
        const father = guardians.find((g: GuardianInfo) => g.relationship === 'father');
        const representative = guardians.find((g: GuardianInfo) => g.relationship === 'representative');

        let representativeType: RepresentativeType = 'mother';
        if (representative?.isRepresentative) {
          representativeType = 'other';
        } else if (mother?.isRepresentative) {
          representativeType = 'mother';
        } else if (father?.isRepresentative) {
          representativeType = 'father';
        }

        form.setFieldsValue({
          gradeId: data.gradeId,
          sectionId: data.sectionId || undefined,
          firstName: data.student.firstName,
          lastName: data.student.lastName,
          documentType: data.student.documentType || 'Venezolano',
          document: data.student.document || undefined,
          gender: data.student.gender || 'M',
          birthdate: data.student.birthdate ? dayjs(data.student.birthdate) : undefined,
          birthState: data.student.residence?.birthState || undefined,
          birthMunicipality: data.student.residence?.birthMunicipality || undefined,
          birthParish: data.student.residence?.birthParish || undefined,
          residenceState: data.student.residence?.residenceState || undefined,
          residenceMunicipality: data.student.residence?.residenceMunicipality || undefined,
          residenceParish: data.student.residence?.residenceParish || undefined,
          address: data.student.contact?.address || undefined,
          phone1: data.student.contact?.phone1 || undefined,
          phone2: data.student.contact?.phone2 || undefined,
          email: data.student.contact?.email || undefined,
          whatsapp: data.student.contact?.whatsapp || undefined,
          representativeType,
          mother: mother
            ? {
                firstName: mother.firstName,
                lastName: mother.lastName,
                document: mother.document,
                phone: mother.phone,
                email: mother.email,
                residenceState: mother.residenceState,
                residenceMunicipality: mother.residenceMunicipality,
                residenceParish: mother.residenceParish,
                address: mother.address
              }
            : undefined,
          father: father
            ? {
                firstName: father.firstName,
                lastName: father.lastName,
                document: father.document,
                phone: father.phone,
                email: father.email,
                residenceState: father.residenceState,
                residenceMunicipality: father.residenceMunicipality,
                residenceParish: father.residenceParish,
                address: father.address
              }
            : undefined,
          representative: representative
            ? {
                firstName: representative.firstName,
                lastName: representative.lastName,
                document: representative.document,
                phone: representative.phone,
                email: representative.email,
                residenceState: representative.residenceState,
                residenceMunicipality: representative.residenceMunicipality,
                residenceParish: representative.residenceParish,
                address: representative.address
              }
            : undefined
        });
      } catch (error) {
        console.error(error);
        message.error('No se pudo cargar la matriculación seleccionada');
      } finally {
        setDetailLoading(false);
      }
    },
    [fetchStructure, form]
  );

  useEffect(() => {
    fetchMatriculations();
    fetchLocations();
  }, [fetchMatriculations, fetchLocations]);

  const handleSearch = () => {
    fetchMatriculations(searchValue.trim() || undefined);
  };

  const handleRefresh = () => {
    setSearchValue('');
    fetchMatriculations();
  };

  const handleSelectMatriculation = (record: MatriculationSummary) => {
    if (selectedId === record.id) return;
    setSelectedId(record.id);
    loadDetail(record.id);
  };

  const getSectionsForGrade = (gradeId: number | null) => {
    if (!gradeId) return [];
    const entry = structure.find((item) => item.gradeId === gradeId);
    return entry?.sections || [];
  };

  const resetGuardianMunicipality = (guardianKey: 'mother' | 'father' | 'representative') => {
    const current = form.getFieldValue(guardianKey) || {};
    form.setFieldsValue({
      [guardianKey]: {
        ...current,
        residenceMunicipality: undefined,
        residenceParish: undefined
      }
    });
  };

  const resetGuardianParish = (guardianKey: 'mother' | 'father' | 'representative') => {
    const current = form.getFieldValue(guardianKey) || {};
    form.setFieldsValue({
      [guardianKey]: {
        ...current,
        residenceParish: undefined
      }
    });
  };

  const stateOptions = useMemo(
    () => locations.map((state) => ({ label: state.estado, value: state.estado })),
    [locations]
  );

  const municipalityOptions = useMemo(
    () => buildMunicipalityOptions(locations, birthStateValue),
    [locations, birthStateValue]
  );

  const parishOptions = useMemo(
    () => buildParishOptions(locations, birthStateValue, birthMunicipalityValue),
    [locations, birthStateValue, birthMunicipalityValue]
  );

  const residenceMunicipalityOptions = useMemo(
    () => buildMunicipalityOptions(locations, residenceStateValue),
    [locations, residenceStateValue]
  );

  const residenceParishOptions = useMemo(
    () => buildParishOptions(locations, residenceStateValue, residenceMunicipalityValue),
    [locations, residenceStateValue, residenceMunicipalityValue]
  );

  const motherMunicipalityOptions = useMemo(
    () => buildMunicipalityOptions(locations, motherStateValue),
    [locations, motherStateValue]
  );

  const motherParishOptions = useMemo(
    () => buildParishOptions(locations, motherStateValue, motherMunicipalityValue),
    [locations, motherStateValue, motherMunicipalityValue]
  );

  const fatherMunicipalityOptions = useMemo(
    () => buildMunicipalityOptions(locations, fatherStateValue),
    [locations, fatherStateValue]
  );

  const fatherParishOptions = useMemo(
    () => buildParishOptions(locations, fatherStateValue, fatherMunicipalityValue),
    [locations, fatherStateValue, fatherMunicipalityValue]
  );

  const representativeMunicipalityOptions = useMemo(
    () => buildMunicipalityOptions(locations, representativeStateValue),
    [locations, representativeStateValue]
  );

  const representativeParishOptions = useMemo(
    () => buildParishOptions(locations, representativeStateValue, representativeMunicipalityValue),
    [locations, representativeStateValue, representativeMunicipalityValue]
  );

  const motherIsRepresentative = representativeTypeValue === 'mother';
  const fatherIsRepresentative = representativeTypeValue === 'father';
  const representativeIsOther = representativeTypeValue === 'other';
  const requireRepresentativeData = representativeIsOther || (!motherIsRepresentative && !fatherIsRepresentative);
  const fatherDataRequired = !!fatherIsRepresentative;

  const handleSubmit = async (values: MatriculationFormValues) => {
    if (!selectedId || !detail) {
      message.warning('Seleccione un estudiante matriculado');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        birthdate: values.birthdate ? values.birthdate.format('YYYY-MM-DD') : null,
        previousSchoolIds: values.previousSchoolIds || []
      };
      await api.post(`/matriculations/${selectedId}/enroll`, payload);
      message.success('Estudiante inscrito correctamente');
      form.resetFields();
      setDetail(null);
      setSelectedId(null);
      fetchMatriculations(searchValue.trim() || undefined);
    } catch (error: unknown) {
      console.error(error);
      const err = error as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || 'Error al inscribir estudiante');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'Estudiante',
      dataIndex: 'student',
      key: 'student',
      render: (student: PersonSummary) => (
        <div>
          <div style={{ fontWeight: 600 }}>{`${student.firstName} ${student.lastName}`}</div>
          <Text type="secondary">{student.document || 'Sin documento'}</Text>
        </div>
      )
    },
    {
      title: 'Grado',
      dataIndex: ['grade', 'name'],
      key: 'grade',
      render: (name: string) => name || '-'
    }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24 }}>
      <Card bordered={false} style={{ height: '100%' }}>
        <div style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.4, color: '#4a4a4a', textTransform: 'uppercase' }}>
            Estudiantes Matriculados
          </Text>
        </div>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="Buscar por nombre o documento"
            prefix={<SearchOutlined />}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
            style={{ width: 200 }}
          />
          <Button onClick={handleSearch} icon={<SearchOutlined />} />
          <Button onClick={handleRefresh} icon={<ReloadOutlined />} />
        </Space>
        {listLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : matriculations.length === 0 ? (
          <Empty description="No hay estudiantes pendientes por inscribir" />
        ) : (
          <Table
            dataSource={matriculations}
            columns={columns}
            size="small"
            pagination={{ pageSize: 6 }}
            rowKey="id"
            onRow={(record) => ({
              onClick: () => handleSelectMatriculation(record),
              style: {
                cursor: 'pointer',
                backgroundColor: record.id === selectedId ? '#e6f4ff' : undefined
              }
            })}
          />
        )}
      </Card>

      <Card
        title="Formulario de Inscripción"
        bordered={false}
        extra={
          detail ? (
            <Tag color="blue">
              Periodo: <strong>{detail.period?.name}</strong>
            </Tag>
          ) : null
        }
      >
        {!selectedId ? (
          <Empty description="Seleccione un estudiante matriculado para continuar" />
        ) : detailLoading || !detail ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{ documentType: 'Venezolano', gender: 'M', representativeType: 'mother' }}
          >
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 20 }}
              message="Datos pre-cargados"
              description="Revise y complete todos los campos antes de inscribir al estudiante."
            />

            <div style={{ background: '#f0f7ff', padding: 16, borderRadius: 8, marginBottom: 24 }}>
              <h4 style={{ color: '#1890ff', marginBottom: 16 }}>1. Datos Académicos</h4>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="gradeId" label="Grado" rules={[{ required: true }]}>
                    <Select
                      placeholder="Seleccione grado"
                      onChange={() => form.setFieldsValue({ sectionId: undefined })}
                    >
                      {structure.map((entry) => (
                        <Option key={entry.gradeId} value={entry.gradeId}>
                          {entry.grade?.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="sectionId" label="Sección" rules={[{ required: false }]}>
                    <Select placeholder="Seleccione sección" allowClear>
                      {getSectionsForGrade(gradeIdValue || null).map((section) => (
                        <Option key={section.id} value={section.id}>
                          {section.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h4 style={{ color: '#666', borderBottom: '1px solid #eee', paddingBottom: 8 }}>
                2. Datos del Estudiante
              </h4>
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
                  <Form.Item name="document" label="Documento">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="gender" label="Género" rules={[{ required: true }]}>
                    <Radio.Group style={{ width: '100%' }}>
                      <Radio.Button value="M" style={{ width: '50%', textAlign: 'center' }}>
                        Masculino
                      </Radio.Button>
                      <Radio.Button value="F" style={{ width: '50%', textAlign: 'center' }}>
                        Femenino
                      </Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="birthdate" label="Fecha Nacimiento" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item
                    name="previousSchoolIds"
                    label="Planteles anteriores"
                    extra="Seleccione los planteles donde el estudiante ha estudiado anteriormente"
                  >
                    <Select
                      mode="multiple"
                      placeholder="Buscar y seleccionar planteles anteriores"
                      loading={previousSchoolsLoading}
                      showSearch
                      filterOption={false}
                      onSearch={searchSchools}
                      options={schoolOptions}
                      style={{ width: '100%' }}
                      notFoundContent={
                        previousSchoolsLoading
                          ? <div style={{ padding: 8 }}>Buscando planteles...</div>
                          : schoolOptions.length === 0
                            ? <div style={{ padding: 8, color: '#999' }}>Escriba al menos 2 caracteres para buscar</div>
                            : null
                      }
                    />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h4 style={{ color: '#666', borderBottom: '1px solid #eee', paddingBottom: 8 }}>
                3. Datos de Nacimiento
              </h4>
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
                      onChange={() => form.setFieldsValue({ birthMunicipality: undefined, birthParish: undefined })}
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
                      onChange={() => form.setFieldsValue({ birthParish: undefined })}
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

            <div style={{ marginBottom: 24 }}>
              <h4 style={{ color: '#666', borderBottom: '1px solid #eee', paddingBottom: 8 }}>
                4. Datos de Residencia
              </h4>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name="residenceState"
                    label="Estado de residencia"
                    rules={[{ required: true, message: 'Seleccione un estado' }]}
                  >
                    <Select
                      placeholder="Seleccione estado"
                      showSearch
                      optionFilterProp="label"
                      filterOption={selectFilterOption}
                      options={stateOptions}
                      onChange={() => form.setFieldsValue({ residenceMunicipality: undefined, residenceParish: undefined })}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="residenceMunicipality"
                    label="Municipio de residencia"
                    rules={[{ required: true, message: 'Seleccione un municipio' }]}
                  >
                    <Select
                      placeholder="Seleccione municipio"
                      showSearch
                      optionFilterProp="label"
                      filterOption={selectFilterOption}
                      options={residenceMunicipalityOptions}
                      disabled={!residenceStateValue}
                      onChange={() => form.setFieldsValue({ residenceParish: undefined })}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="residenceParish"
                    label="Parroquia de residencia"
                    rules={[{ required: true, message: 'Seleccione una parroquia' }]}
                  >
                    <Select
                      placeholder="Seleccione parroquia"
                      showSearch
                      optionFilterProp="label"
                      filterOption={selectFilterOption}
                      options={residenceParishOptions}
                      disabled={!residenceMunicipalityValue}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item name="address" label="Dirección" rules={[{ required: true }]}>
                    <Input.TextArea rows={2} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="phone1" label="Teléfono 1" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="phone2" label="Teléfono 2">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}>
                    <Input />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="whatsapp" label="WhatsApp">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 32 }}>
              <h4 style={{ color: '#666', borderBottom: '1px solid #eee', paddingBottom: 8 }}>
                5. Datos Familiares y Representante
              </h4>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message="Registrar madre, padre y representante"
                description="La madre siempre es obligatoria. El padre solo es opcional cuando el estudiante tiene Cédula Escolar y no será el representante. Si el representante no es la madre ni el padre, complete la sección de 'Representante'."
              />

              <Form.Item
                name="representativeType"
                label="¿Quién será el representante legal?"
                rules={[{ required: true, message: 'Seleccione un representante' }]}
              >
                <Radio.Group>
                  <Radio value="mother">Madre</Radio>
                  <Radio value="father">Padre</Radio>
                  <Radio value="other">Otra persona</Radio>
                </Radio.Group>
              </Form.Item>

              <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: 16, marginBottom: 24 }}>
                <h5 style={{ marginBottom: 16 }}>Madre (obligatoria)</h5>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name={['mother', 'firstName']}
                      label="Nombres"
                      rules={[{ required: true, message: 'Ingrese los nombres de la madre' }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name={['mother', 'lastName']}
                      label="Apellidos"
                      rules={[{ required: true, message: 'Ingrese los apellidos de la madre' }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name={['mother', 'document']}
                      label="Cédula"
                      rules={[{ required: true, message: 'Ingrese la cédula de la madre' }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['mother', 'phone']}
                      label="Teléfono"
                      rules={[{ required: true, message: 'Ingrese el teléfono de la madre' }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['mother', 'email']}
                      label="Email"
                      rules={[
                        { required: true, message: 'Ingrese el email de la madre' },
                        { type: 'email', message: 'Email inválido' }
                      ]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name={['mother', 'residenceState']}
                      label="Estado de residencia"
                      rules={[{ required: true, message: 'Seleccione el estado de residencia' }]}
                    >
                      <Select
                        placeholder="Seleccione estado"
                        showSearch
                        optionFilterProp="label"
                        filterOption={selectFilterOption}
                        options={stateOptions}
                        onChange={() => resetGuardianMunicipality('mother')}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['mother', 'residenceMunicipality']}
                      label="Municipio de residencia"
                      rules={[{ required: true, message: 'Seleccione el municipio de residencia' }]}
                    >
                      <Select
                        placeholder="Seleccione municipio"
                        showSearch
                        optionFilterProp="label"
                        filterOption={selectFilterOption}
                        options={motherMunicipalityOptions}
                        disabled={!motherStateValue}
                        onChange={() => resetGuardianParish('mother')}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['mother', 'residenceParish']}
                      label="Parroquia de residencia"
                      rules={[{ required: true, message: 'Seleccione la parroquia de residencia' }]}
                    >
                      <Select
                        placeholder="Seleccione parroquia"
                        showSearch
                        optionFilterProp="label"
                        filterOption={selectFilterOption}
                        options={motherParishOptions}
                        disabled={!motherMunicipalityValue}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row>
                  <Col span={24}>
                    <Form.Item
                      name={['mother', 'address']}
                      label="Dirección"
                      rules={[{ required: true, message: 'Ingrese la dirección de la madre' }]}
                    >
                      <Input.TextArea rows={2} />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: 16, marginBottom: 24 }}>
                <h5 style={{ marginBottom: 16 }}>
                  Padre {fatherDataRequired ? '(obligatorio)' : '(opcional)'}
                </h5>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name={['father', 'firstName']}
                      label="Nombres"
                      rules={
                        fatherDataRequired
                          ? [{ required: true, message: 'Ingrese los nombres del padre' }]
                          : []
                      }
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name={['father', 'lastName']}
                      label="Apellidos"
                      rules={
                        fatherDataRequired
                          ? [{ required: true, message: 'Ingrese los apellidos del padre' }]
                          : []
                      }
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name={['father', 'document']}
                      label="Cédula"
                      rules={
                        fatherDataRequired
                          ? [{ required: true, message: 'Ingrese la cédula del padre' }]
                          : []
                      }
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['father', 'phone']}
                      label="Teléfono"
                      rules={
                        fatherDataRequired
                          ? [{ required: true, message: 'Ingrese el teléfono del padre' }]
                          : []
                      }
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['father', 'email']}
                      label="Email"
                      rules={
                        fatherDataRequired
                          ? [
                              { required: true, message: 'Ingrese el email del padre' },
                              { type: 'email', message: 'Email inválido' }
                            ]
                          : [{ type: 'email', message: 'Email inválido' }]
                      }
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name={['father', 'residenceState']}
                      label="Estado de residencia"
                      rules={
                        fatherDataRequired
                          ? [{ required: true, message: 'Seleccione el estado de residencia' }]
                          : []
                      }
                    >
                      <Select
                        placeholder="Seleccione estado"
                        showSearch
                        optionFilterProp="label"
                        filterOption={selectFilterOption}
                        options={stateOptions}
                        onChange={() => resetGuardianMunicipality('father')}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['father', 'residenceMunicipality']}
                      label="Municipio de residencia"
                      rules={
                        fatherDataRequired
                          ? [{ required: true, message: 'Seleccione el municipio de residencia' }]
                          : []
                      }
                    >
                      <Select
                        placeholder="Seleccione municipio"
                        showSearch
                        optionFilterProp="label"
                        filterOption={selectFilterOption}
                        options={fatherMunicipalityOptions}
                        disabled={!fatherStateValue}
                        onChange={() => resetGuardianParish('father')}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['father', 'residenceParish']}
                      label="Parroquia de residencia"
                      rules={
                        fatherDataRequired
                          ? [{ required: true, message: 'Seleccione la parroquia de residencia' }]
                          : []
                      }
                    >
                      <Select
                        placeholder="Seleccione parroquia"
                        showSearch
                        optionFilterProp="label"
                        filterOption={selectFilterOption}
                        options={fatherParishOptions}
                        disabled={!fatherMunicipalityValue}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row>
                  <Col span={24}>
                    <Form.Item
                      name={['father', 'address']}
                      label="Dirección"
                      rules={
                        fatherDataRequired
                          ? [{ required: true, message: 'Ingrese la dirección del padre' }]
                          : []
                      }
                    >
                      <Input.TextArea rows={2} />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: 16 }}>
                <h5 style={{ marginBottom: 16 }}>
                  Representante {requireRepresentativeData ? '(obligatorio)' : '(opcional)'}
                </h5>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name={['representative', 'firstName']}
                      label="Nombres"
                      rules={
                        requireRepresentativeData
                          ? [{ required: true, message: 'Ingrese los nombres del representante' }]
                          : []
                      }
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name={['representative', 'lastName']}
                      label="Apellidos"
                      rules={
                        requireRepresentativeData
                          ? [{ required: true, message: 'Ingrese los apellidos del representante' }]
                          : []
                      }
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name={['representative', 'document']}
                      label="Cédula"
                      rules={
                        requireRepresentativeData
                          ? [{ required: true, message: 'Ingrese la cédula del representante' }]
                          : []
                      }
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['representative', 'phone']}
                      label="Teléfono"
                      rules={
                        requireRepresentativeData
                          ? [{ required: true, message: 'Ingrese el teléfono del representante' }]
                          : []
                      }
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['representative', 'email']}
                      label="Email"
                      rules={
                        requireRepresentativeData
                          ? [
                              { required: true, message: 'Ingrese el email del representante' },
                              { type: 'email', message: 'Email inválido' }
                            ]
                          : [{ type: 'email', message: 'Email inválido' }]
                      }
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name={['representative', 'residenceState']}
                      label="Estado de residencia"
                      rules={
                        requireRepresentativeData
                          ? [{ required: true, message: 'Seleccione el estado de residencia' }]
                          : []
                      }
                    >
                      <Select
                        placeholder="Seleccione estado"
                        showSearch
                        optionFilterProp="label"
                        filterOption={selectFilterOption}
                        options={stateOptions}
                        onChange={() => resetGuardianMunicipality('representative')}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['representative', 'residenceMunicipality']}
                      label="Municipio de residencia"
                      rules={
                        requireRepresentativeData
                          ? [{ required: true, message: 'Seleccione el municipio de residencia' }]
                          : []
                      }
                    >
                      <Select
                        placeholder="Seleccione municipio"
                        showSearch
                        optionFilterProp="label"
                        filterOption={selectFilterOption}
                        options={representativeMunicipalityOptions}
                        disabled={!representativeStateValue}
                        onChange={() => resetGuardianParish('representative')}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['representative', 'residenceParish']}
                      label="Parroquia de residencia"
                      rules={
                        requireRepresentativeData
                          ? [{ required: true, message: 'Seleccione la parroquia de residencia' }]
                          : []
                      }
                    >
                      <Select
                        placeholder="Seleccione parroquia"
                        showSearch
                        optionFilterProp="label"
                        filterOption={selectFilterOption}
                        options={representativeParishOptions}
                        disabled={!representativeMunicipalityValue}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row>
                  <Col span={24}>
                    <Form.Item
                      name={['representative', 'address']}
                      label="Dirección"
                      rules={
                        requireRepresentativeData
                          ? [{ required: true, message: 'Ingrese la dirección del representante' }]
                          : []
                      }
                    >
                      <Input.TextArea rows={2} />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            </div>

            <Form.Item style={{ marginTop: 24, textAlign: 'right' }}>
              <Button
                type="primary"
                htmlType="submit"
                icon={<UserAddOutlined />}
                size="large"
                loading={submitting}
              >
                Inscribir Estudiante
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>
    </div>
  );
};

export default MatriculationEnrollment;
