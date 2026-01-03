import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Button, Form, Tag, message, Select, Row, Col, Input, DatePicker, Radio, Tabs, Alert } from 'antd';
import { UserAddOutlined, LoadingOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '@/services/api';
import EnrollmentQuestionFields from '@/components/EnrollmentQuestionFields';
import { getEnrollmentQuestions, getEnrollmentQuestionsForPerson } from '@/services/enrollmentQuestions';
import type { EnrollmentQuestionResponse } from '@/services/enrollmentQuestions';
import { searchGuardian } from '@/services/guardians';
import type { GuardianDocumentType, GuardianProfileResponse } from '@/services/guardians';

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

type OptionItem = { label: string; value: string };

type SchoolSearchResult = {
  code?: string;
  name: string;
  state: string;
};

type SchoolPeriod = {
  id: number;
  period: string;
  name: string;
  startYear: number;
  endYear: number;
  isActive: boolean;
};

type Grade = {
  id: number;
  name: string;
};

type Section = {
  id: number;
  name: string;
  PeriodGradeSection?: { id: number };
};

type Subject = {
  id: number;
  name: string;
  PeriodGradeSubject?: { id: number; order: number };
  subjectGroup?: { id: number; name: string };
};

type EnrollStructureItem = {
  id: number;
  gradeId: number;
  schoolPeriodId: number;
  specializationId?: number | null;
  grade?: Grade;
  sections?: Section[];
  subjects?: Subject[];
};

type UserSearchResult = {
  id: number;
  firstName: string;
  lastName: string;
  document: string;
  roles: { name: string }[];
};

type GuardianData = {
  firstName?: string;
  lastName?: string;
  documentType?: GuardianDocumentType;
  document?: string;
  phone?: string;
  email?: string;
  residenceState?: string;
  residenceMunicipality?: string;
  residenceParish?: string;
  address?: string;
};

const selectFilterOption = (input: string, option?: { label?: string }) =>
  (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase());

type GuardianKey = 'mother' | 'father' | 'representative';

const guardianDocumentOptions: { label: string; value: GuardianDocumentType }[] = [
  { label: 'Venezolano', value: 'Venezolano' },
  { label: 'Extranjero', value: 'Extranjero' },
  { label: 'Pasaporte', value: 'Pasaporte' }
];

const ESCOLARIDAD_OPTIONS = [
  { label: 'Regular', value: 'regular' },
  { label: 'Repitiente', value: 'repitiente' },
  { label: 'Materia pendiente', value: 'materia_pendiente' }
];

const guardianLabels: Record<GuardianKey, string> = {
  mother: 'la madre',
  father: 'el padre',
  representative: 'el representante'
};

const mapProfileToGuardianForm = (profile: GuardianProfileResponse): GuardianData => ({
  firstName: profile.firstName,
  lastName: profile.lastName,
  documentType: profile.documentType,
  document: profile.document,
  phone: profile.phone,
  email: profile.email,
  residenceState: profile.residenceState,
  residenceMunicipality: profile.residenceMunicipality,
  residenceParish: profile.residenceParish,
  address: profile.address
});

const buildGuardianCacheKey = (documentType?: GuardianDocumentType, document?: string) => {
  if (!documentType || !document?.trim()) return '';
  return `${documentType}-${document.trim()}`;
};

const buildMunicipalityOptions = (
  locations: VenezuelaState[],
  stateName?: string | null
): OptionItem[] => {
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
): OptionItem[] => {
  if (!stateName || !municipalityName) return [];
  const selectedState = locations.find((state) => state.estado === stateName);
  const selectedMunicipality = selectedState?.municipios.find(
    (municipio) => municipio.municipio === municipalityName
  );
  return selectedMunicipality
    ? selectedMunicipality.parroquias.map((parish) => ({ label: parish, value: parish }))
    : [];
};

const guardianHasAnyValue = (fields?: Record<string, unknown>) => {
  if (!fields) return false;
  return Object.values(fields).some((value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
  });
};

type EnrollmentAnswerFormValues = Record<number, string | string[]>;

const transformAnswers = (raw?: EnrollmentAnswerFormValues) => {
  if (!raw) return [];
  return Object.entries(raw).map(([key, value]) => ({
    questionId: Number(key),
    answer: value
  }));
};

const EnrollStudent: React.FC = () => {
  // State
  const [activePeriod, setActivePeriod] = useState<SchoolPeriod | null>(null);
  const [enrollStructure, setEnrollStructure] = useState<EnrollStructureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [venezuelaLocations, setVenezuelaLocations] = useState<VenezuelaState[]>([]);
  const [schoolOptions, setSchoolOptions] = useState<OptionItem[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [enrollmentQuestions, setEnrollmentQuestions] = useState<EnrollmentQuestionResponse[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [existingEnrollmentQuestions, setExistingEnrollmentQuestions] = useState<EnrollmentQuestionResponse[]>([]);
  const [existingQuestionsLoading, setExistingQuestionsLoading] = useState(false);

  // For section selector (controlled)
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);
  const [selectedGradeIdExisting, setSelectedGradeIdExisting] = useState<number | null>(null);

  // Existing Student State
  const [studentOptions, setStudentOptions] = useState<OptionItem[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Forms
  const [newStudentForm] = Form.useForm();
  const [existingStudentForm] = Form.useForm();
  const [guardianLookupLoading, setGuardianLookupLoading] = useState<GuardianKey | null>(null);
  const guardianLookupCache = React.useRef<Record<GuardianKey, string>>({
    mother: '',
    father: '',
    representative: ''
  });
  const documentTypeValue = Form.useWatch('documentType', newStudentForm);
  const representativeTypeValue = Form.useWatch('representativeType', newStudentForm);
  const birthStateValue = Form.useWatch('birthState', newStudentForm);
  const birthMunicipalityValue = Form.useWatch('birthMunicipality', newStudentForm);
  const residenceStateValue = Form.useWatch('residenceState', newStudentForm);
  const residenceMunicipalityValue = Form.useWatch('residenceMunicipality', newStudentForm);
  const motherStateValue = Form.useWatch(['mother', 'residenceState'], newStudentForm);
  const motherMunicipalityValue = Form.useWatch(['mother', 'residenceMunicipality'], newStudentForm);
  const fatherStateValue = Form.useWatch(['father', 'residenceState'], newStudentForm);
  const fatherMunicipalityValue = Form.useWatch(['father', 'residenceMunicipality'], newStudentForm);
  const representativeStateValue = Form.useWatch(['representative', 'residenceState'], newStudentForm);
  const representativeMunicipalityValue = Form.useWatch(['representative', 'residenceMunicipality'], newStudentForm);
  const motherDocumentTypeValue = Form.useWatch(['mother', 'documentType'], newStudentForm) as GuardianDocumentType | undefined;
  const motherDocumentValue = Form.useWatch(['mother', 'document'], newStudentForm) as string | undefined;
  const fatherDocumentTypeValue = Form.useWatch(['father', 'documentType'], newStudentForm) as GuardianDocumentType | undefined;
  const fatherDocumentValue = Form.useWatch(['father', 'document'], newStudentForm) as string | undefined;
  const representativeDocumentTypeValue = Form.useWatch(['representative', 'documentType'], newStudentForm) as GuardianDocumentType | undefined;
  const representativeDocumentValue = Form.useWatch(['representative', 'document'], newStudentForm) as string | undefined;

  const searchSchools = async (query: string) => {
    if (!query || query.length < 2) {
      setSchoolOptions([]);
      return;
    }

    setLoadingSchools(true);
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
      setLoadingSchools(false);
    }
  };

  const handleGuardianLookup = useCallback(
    async (guardianKey: GuardianKey, documentType?: GuardianDocumentType, document?: string) => {
      const cacheKey = buildGuardianCacheKey(documentType, document);

      // If no document info, clear cache entry and stop
      if (!cacheKey) {
        guardianLookupCache.current[guardianKey] = '';
        return;
      }

      // Stop if searching for the same thing
      if (guardianLookupCache.current[guardianKey] === cacheKey) {
        return;
      }

      setGuardianLookupLoading(guardianKey);
      try {
        const profile = await searchGuardian(documentType!, document!.trim());
        if (profile) {
          const merged = {
            ...(newStudentForm.getFieldValue(guardianKey) || {}),
            ...mapProfileToGuardianForm(profile)
          };
          newStudentForm.setFieldsValue({
            [guardianKey]: merged
          });
          message.success(`Datos de ${guardianLabels[guardianKey]} encontrados.`);
        } else {
          // message.info(`No se encontró registro previo para ${guardianLabels[guardianKey]}.`);
        }
        // Update cache AFTER successful lookup or if not found (to avoid repeated "not found" messages)
        guardianLookupCache.current[guardianKey] = cacheKey;
      } catch (error) {
        console.error('Error buscando representante:', error);
        message.error(`No se pudieron cargar los datos de ${guardianLabels[guardianKey]}`);
      } finally {
        setGuardianLookupLoading(null);
      }
    },
    [newStudentForm]
  );

  useEffect(() => {
    if (motherDocumentTypeValue && motherDocumentValue && motherDocumentValue.length >= 6) {
      const timeoutId = setTimeout(() => {
        handleGuardianLookup('mother', motherDocumentTypeValue, motherDocumentValue);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [motherDocumentTypeValue, motherDocumentValue, handleGuardianLookup]);

  useEffect(() => {
    if (fatherDocumentTypeValue && fatherDocumentValue && fatherDocumentValue.length >= 6) {
      const timeoutId = setTimeout(() => {
        handleGuardianLookup('father', fatherDocumentTypeValue, fatherDocumentValue);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [fatherDocumentTypeValue, fatherDocumentValue, handleGuardianLookup]);

  useEffect(() => {
    if (representativeDocumentTypeValue && representativeDocumentValue && representativeDocumentValue.length >= 6) {
      const timeoutId = setTimeout(() => {
        handleGuardianLookup('representative', representativeDocumentTypeValue, representativeDocumentValue);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [representativeDocumentTypeValue, representativeDocumentValue, handleGuardianLookup]);

  const renderGuardianDocumentControls = (guardianKey: GuardianKey, required: boolean) => (
    <Row gutter={16}>
      <Col span={8}>
        <Form.Item
          name={[guardianKey, 'documentType']}
          label="Tipo de documento"
          rules={
            required
              ? [{ required: true, message: `Seleccione el tipo de documento de ${guardianLabels[guardianKey]}` }]
              : []
          }
        >
          <Select placeholder="Seleccione" options={guardianDocumentOptions} />
        </Form.Item>
      </Col>
      <Col span={16}>
        <Form.Item
          name={[guardianKey, 'document']}
          label="Número de documento"
          rules={
            required
              ? [{ required: true, message: `Ingrese la cédula de ${guardianLabels[guardianKey]}` }]
              : []
          }
        >
          <Input
            placeholder="Ej: 12345678"
            suffix={guardianLookupLoading === guardianKey ? <LoadingOutlined spin /> : undefined}
          />
        </Form.Item>
      </Col>
    </Row>
  );

  // Load Active Period and its structure on mount
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        // 1. Get periods and find active
        const periodsRes = await api.get('/academic/periods');
        const active = periodsRes.data.find((p: SchoolPeriod) => p.isActive);

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

        setQuestionsLoading(true);
        const dynamicQuestions = await getEnrollmentQuestions(false);
        setEnrollmentQuestions(dynamicQuestions);
      } catch (error) {
        console.log(error);
        message.error('Error cargando datos del periodo activo');
      } finally {
        setLoading(false);
        setQuestionsLoading(false);
      }
    };
    init();
  }, []);

  const loadExistingQuestions = async (personId: number) => {
    setExistingQuestionsLoading(true);
    try {
      const questions = await getEnrollmentQuestionsForPerson(personId);
      setExistingEnrollmentQuestions(questions);
      const answers: EnrollmentAnswerFormValues = {};
      questions.forEach((question) => {
        if (question.answer !== null && question.answer !== undefined) {
          answers[question.id] = question.answer as string | string[];
        }
      });
      existingStudentForm.setFieldsValue({ enrollmentAnswers: answers });
    } catch (error) {
      console.error('Error cargando preguntas adicionales:', error);
      message.error('No se pudieron cargar las preguntas del formulario');
      setExistingEnrollmentQuestions([]);
    } finally {
      setExistingQuestionsLoading(false);
    }
  };

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

  const residenceStateOptions = stateOptions;

  const selectedResidenceState = useMemo(
    () => venezuelaLocations.find((state) => state.estado === residenceStateValue) || null,
    [residenceStateValue, venezuelaLocations]
  );

  const residenceMunicipalityOptions = useMemo(
    () =>
      selectedResidenceState
        ? selectedResidenceState.municipios.map((municipio) => ({
          label: municipio.municipio,
          value: municipio.municipio
        }))
        : [],
    [selectedResidenceState]
  );

  const selectedResidenceMunicipality = useMemo(
    () =>
      selectedResidenceState?.municipios.find((municipio) => municipio.municipio === residenceMunicipalityValue) ||
      null,
    [selectedResidenceState, residenceMunicipalityValue]
  );

  const residenceParishOptions = useMemo(
    () =>
      selectedResidenceMunicipality
        ? selectedResidenceMunicipality.parroquias.map((parish) => ({ label: parish, value: parish }))
        : [],
    [selectedResidenceMunicipality]
  );

  const motherMunicipalityOptions = useMemo(
    () => buildMunicipalityOptions(venezuelaLocations, motherStateValue),
    [venezuelaLocations, motherStateValue]
  );
  const motherParishOptions = useMemo(
    () => buildParishOptions(venezuelaLocations, motherStateValue, motherMunicipalityValue),
    [venezuelaLocations, motherStateValue, motherMunicipalityValue]
  );

  const fatherMunicipalityOptions = useMemo(
    () => buildMunicipalityOptions(venezuelaLocations, fatherStateValue),
    [venezuelaLocations, fatherStateValue]
  );
  const fatherParishOptions = useMemo(
    () => buildParishOptions(venezuelaLocations, fatherStateValue, fatherMunicipalityValue),
    [venezuelaLocations, fatherStateValue, fatherMunicipalityValue]
  );

  const representativeMunicipalityOptions = useMemo(
    () => buildMunicipalityOptions(venezuelaLocations, representativeStateValue),
    [venezuelaLocations, representativeStateValue]
  );
  const representativeParishOptions = useMemo(
    () => buildParishOptions(venezuelaLocations, representativeStateValue, representativeMunicipalityValue),
    [venezuelaLocations, representativeStateValue, representativeMunicipalityValue]
  );

  const motherIsRepresentative = representativeTypeValue === 'mother';
  const fatherIsRepresentative = representativeTypeValue === 'father';
  const representativeIsOther = representativeTypeValue === 'other';
  const requireRepresentativeData = representativeIsOther || (!motherIsRepresentative && !fatherIsRepresentative);
  const fatherDataRequired =
    (documentTypeValue ?? 'Venezolano') !== 'Cedula Escolar' || fatherIsRepresentative;
  const fatherHasAnyValue = guardianHasAnyValue(newStudentForm.getFieldValue('father'));
  const representativeHasAnyValue = guardianHasAnyValue(newStudentForm.getFieldValue('representative'));
  const fatherFieldsRequired = fatherDataRequired || fatherHasAnyValue;
  const representativeFieldsRequired = requireRepresentativeData || representativeHasAnyValue;

  const resetGuardianMunicipality = (guardianKey: 'mother' | 'father' | 'representative') => {
    const current = newStudentForm.getFieldValue(guardianKey) as GuardianData || {};
    newStudentForm.setFieldsValue({
      [guardianKey]: {
        ...current,
        residenceMunicipality: undefined,
        residenceParish: undefined
      } as GuardianData
    });
  };

  const resetGuardianParish = (guardianKey: 'mother' | 'father' | 'representative') => {
    const current = newStudentForm.getFieldValue(guardianKey) as GuardianData || {};
    newStudentForm.setFieldsValue({
      [guardianKey]: {
        ...current,
        residenceParish: undefined
      } as GuardianData
    });
  };

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
        const students = res.data.filter((p: UserSearchResult) =>
          p.roles?.some((r) => ['student', 'estudiante', 'alumno'].includes(r.name.toLowerCase()))
        );
        setStudentOptions(students.map((p: UserSearchResult) => ({
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
  const handleNewStudentSubmit = async (values: Record<string, unknown>) => {
    if (!activePeriod) {
      message.error('No hay periodo activo');
      return;
    }

    try {
      const payload = {
        ...values,
        schoolPeriodId: activePeriod.id,
        birthdate: values.birthdate ? (values.birthdate as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        enrollmentAnswers: transformAnswers(values.enrollmentAnswers as EnrollmentAnswerFormValues | undefined)
      };

      await api.post('/inscriptions/register', payload);

      message.success('Solicitud de inscripción registrada exitosamente');
      newStudentForm.resetFields();
      setSelectedGradeId(null);
    } catch (error: unknown) {
      console.error(error);
      const err = error as { response?: { data?: { error?: string; message?: string } } };
      message.error(err.response?.data?.error || err.response?.data?.message || 'Error al procesar la solicitud');
    }
  };

  // Submit: Existing Student
  const handleExistingStudentSubmit = async (values: Record<string, unknown>) => {
    if (!activePeriod) {
      message.error('No hay periodo activo');
      return;
    }

    try {
      await api.post('/inscriptions', {
        ...values,
        schoolPeriodId: activePeriod.id,
        enrollmentAnswers: transformAnswers(values.enrollmentAnswers as EnrollmentAnswerFormValues | undefined)
      });
      message.success('Solicitud de inscripción registrada exitosamente');
      existingStudentForm.resetFields();
      setSelectedGradeIdExisting(null);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      message.error(err.response?.data?.error || 'Error en inscripción');
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
      <Card title="Inscripción de Estudiantes">
        <Tabs defaultActiveKey="new">

          {/* TAB 1: NEW STUDENT */}
          <TabPane tab="Nuevo Ingreso (Registrar e Inscribir)" key="new">
            <Form
              form={newStudentForm}
              layout="vertical"
              onFinish={handleNewStudentSubmit}
              initialValues={{
                documentType: 'Venezolano',
                gender: 'M',
                representativeType: 'mother',
                escolaridad: 'regular'
              }}
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
                        {getSectionsForGrade(selectedGradeId).map((sec: Section) => (
                          <Option key={sec.id} value={sec.id}>{sec.name}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="escolaridad"
                      label="Escolaridad"
                      rules={[{ required: true, message: 'Seleccione la escolaridad del estudiante' }]}
                    >
                      <Select placeholder="Seleccione" options={ESCOLARIDAD_OPTIONS} />
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

              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#666', borderBottom: '1px solid #eee', paddingBottom: 8 }}>4. Datos de Residencia</h4>
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
                        options={residenceStateOptions}
                        onChange={() => newStudentForm.setFieldsValue({
                          residenceMunicipality: undefined,
                          residenceParish: undefined
                        })}
                        disabled={!stateOptions.length}
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
                        onChange={() => newStudentForm.setFieldsValue({ residenceParish: undefined })}
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
              </div>

              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#666', borderBottom: '1px solid #eee', paddingBottom: 8 }}>4.5. Procedencia Escolar (Opcional)</h4>
                <Form.Item name="previousSchoolIds" label="Planteles anteriores">
                  <Select
                    mode="multiple"
                    placeholder="Escriba para buscar y seleccionar planteles..."
                    filterOption={false}
                    onSearch={searchSchools}
                    loading={loadingSchools}
                    options={schoolOptions}
                    allowClear
                  />
                </Form.Item>
              </div>

              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#666', borderBottom: '1px solid #eee', paddingBottom: 8 }}>5. Datos de Contacto</h4>
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
                    <Form.Item name="phone2" label="Teléfono Secundario">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="whatsapp" label="WhatsApp">
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

              <div style={{ marginBottom: 32 }}>
                <h4 style={{ color: '#666', borderBottom: '1px solid #eee', paddingBottom: 8 }}>6. Datos Familiares y Representante</h4>
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
                  {renderGuardianDocumentControls('mother', true)}
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
                  {renderGuardianDocumentControls('father', fatherFieldsRequired)}
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name={['father', 'firstName']}
                        label="Nombres"
                        rules={fatherFieldsRequired ? [{ required: true, message: 'Ingrese los nombres del padre' }] : []}
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name={['father', 'lastName']}
                        label="Apellidos"
                        rules={fatherFieldsRequired ? [{ required: true, message: 'Ingrese los apellidos del padre' }] : []}
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name={['father', 'phone']}
                        label="Teléfono"
                        rules={fatherFieldsRequired ? [{ required: true, message: 'Ingrese el teléfono del padre' }] : []}
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name={['father', 'email']}
                        label="Email"
                        rules={[
                          ...(fatherFieldsRequired ? [{ required: true, message: 'Ingrese el email del padre' }] : []),
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
                        name={['father', 'residenceState']}
                        label="Estado de residencia"
                        rules={fatherFieldsRequired ? [{ required: true, message: 'Seleccione el estado de residencia' }] : []}
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
                        rules={fatherFieldsRequired ? [{ required: true, message: 'Seleccione el municipio de residencia' }] : []}
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
                        rules={fatherFieldsRequired ? [{ required: true, message: 'Seleccione la parroquia de residencia' }] : []}
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
                        rules={fatherFieldsRequired ? [{ required: true, message: 'Ingrese la dirección del padre' }] : []}
                      >
                        <Input.TextArea rows={2} />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>

                {(representativeFieldsRequired || representativeIsOther) && (
                  <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: 16 }}>
                    <h5 style={{ marginBottom: 16 }}>Representante (solo si es diferente)</h5>
                    {renderGuardianDocumentControls('representative', representativeFieldsRequired)}
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name={['representative', 'firstName']}
                          label="Nombres"
                          rules={representativeFieldsRequired ? [{ required: true, message: 'Ingrese los nombres del representante' }] : []}
                        >
                          <Input />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name={['representative', 'lastName']}
                          label="Apellidos"
                          rules={representativeFieldsRequired ? [{ required: true, message: 'Ingrese los apellidos del representante' }] : []}
                        >
                          <Input />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name={['representative', 'phone']}
                          label="Teléfono"
                          rules={representativeFieldsRequired ? [{ required: true, message: 'Ingrese el teléfono del representante' }] : []}
                        >
                          <Input />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name={['representative', 'email']}
                          label="Email"
                          rules={[
                            ...(representativeFieldsRequired ? [{ required: true, message: 'Ingrese el email del representante' }] : []),
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
                          name={['representative', 'residenceState']}
                          label="Estado de residencia"
                          rules={representativeFieldsRequired ? [{ required: true, message: 'Seleccione el estado de residencia' }] : []}
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
                          rules={representativeFieldsRequired ? [{ required: true, message: 'Seleccione el municipio de residencia' }] : []}
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
                          rules={representativeFieldsRequired ? [{ required: true, message: 'Seleccione la parroquia de residencia' }] : []}
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
                          rules={representativeFieldsRequired ? [{ required: true, message: 'Ingrese la dirección del representante' }] : []}
                        >
                          <Input.TextArea rows={2} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                )}
              </div>

              {questionsLoading ? (
                <Card loading style={{ marginBottom: 24 }} />
              ) : enrollmentQuestions.length > 0 ? (
                <div style={{ marginBottom: 32 }}>
                  <h4 style={{ color: '#666', borderBottom: '1px solid #eee', paddingBottom: 8 }}>
                    7. Preguntas adicionales del plantel
                  </h4>
                  <EnrollmentQuestionFields
                    questions={enrollmentQuestions}
                    parentName="enrollmentAnswers"
                  />
                </div>
              ) : null}

              <Form.Item style={{ marginTop: 24 }}>
                <Button type="primary" htmlType="submit" block size="large" icon={<UserAddOutlined />}>
                  Inscribir Estudiante
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
              initialValues={{ escolaridad: 'regular' }}
            >
              <Form.Item
                name="personId"
                label="Estudiante (escriba al menos 2 caracteres para buscar)"
                rules={[{ required: true, message: 'Busque y seleccione un estudiante' }]}
              >
                <Select
                  placeholder="Escriba nombre o cédula..."
                  filterOption={false}
                  onSearch={handleSearchStudents}
                  onChange={(personId: number) => {
                    existingStudentForm.setFieldsValue({ personId });
                    loadExistingQuestions(personId);
                  }}
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
                      {getSectionsForGrade(selectedGradeIdExisting).map((sec: Section) => (
                        <Option key={sec.id} value={sec.id}>{sec.name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="escolaridad"
                    label="Escolaridad"
                    rules={[{ required: true, message: 'Seleccione la escolaridad del estudiante' }]}
                  >
                    <Select placeholder="Seleccione" options={ESCOLARIDAD_OPTIONS} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item>
                <Button type="primary" htmlType="submit" block icon={<UserAddOutlined />}>
                  Inscribir Estudiante
                </Button>
              </Form.Item>

              {existingEnrollmentQuestions.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ color: '#666', borderBottom: '1px solid #eee', paddingBottom: 8 }}>
                    Preguntas adicionales del plantel
                  </h4>
                  {existingQuestionsLoading ? (
                    <Card loading />
                  ) : (
                    <EnrollmentQuestionFields
                      questions={existingEnrollmentQuestions}
                      parentName="enrollmentAnswers"
                    />
                  )}
                </div>
              )}
            </Form>
          </TabPane>
        </Tabs>
      </Card>
    </div >
  );
};

export default EnrollStudent;
