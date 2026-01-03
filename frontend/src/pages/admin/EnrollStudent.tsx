import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Button, Form, Tag, message, Select, Row, Col, Input, DatePicker, Radio, Tabs, Alert, Checkbox, Upload, Modal } from 'antd';
import type { UploadFile, RcFile } from 'antd/es/upload/interface';
import { UserAddOutlined, LoadingOutlined, UploadOutlined } from '@ant-design/icons';
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

type OptionItem = { label: string; value: string | number };

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

type EnrollmentAnswerFormValues = Record<number, string | string[]>;

const transformAnswers = (raw?: EnrollmentAnswerFormValues) => {
  if (!raw) return [];
  return Object.entries(raw).map(([key, value]) => ({
    questionId: Number(key),
    answer: value
  }));
};

const normFile = (e: any) => {
  if (Array.isArray(e)) {
    return e;
  }
  return e?.fileList;
};

const getBase64 = (file: RcFile): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

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

  // Preview State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
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

  const receivedInformesMedicos = Form.useWatch(['documents', 'receivedInformesMedicos'], newStudentForm);

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
          <Select placeholder="Seleccione" options={guardianDocumentOptions} allowClear />
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

  // Dynamic Requirements: Strictly mandatory only if they are the representative
  const motherFieldsRequired = motherIsRepresentative;
  const fatherFieldsRequired = fatherIsRepresentative;
  const representativeFieldsRequired = representativeIsOther;

  const showMotherDetails = !!(motherDocumentTypeValue && motherDocumentValue);
  const showFatherDetails = !!(fatherDocumentTypeValue && fatherDocumentValue);
  const showRepresentativeDetails = !!(representativeDocumentTypeValue && representativeDocumentValue);

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

  // Preview Handlers
  const handleCancelPreview = () => setPreviewOpen(false);

  const handlePreview = async (file: UploadFile) => {
    if (!file.url && !file.preview) {
      file.preview = await getBase64(file.originFileObj as RcFile);
    }

    let url = file.url || (file.preview as string);
    // If it's a relative path from the server, prepend the host
    if (url && url.startsWith('/uploads')) {
      url = `http://localhost:3000${url}`;
    }

    setPreviewImage(url);
    setPreviewOpen(true);
    setPreviewTitle(file.name || url.substring(url.lastIndexOf('/') + 1));
  };

  // Submit: New Student
  const handleNewStudentSubmit = async (values: Record<string, unknown>) => {
    if (!activePeriod) {
      message.error('No hay periodo activo');
      return;
    }

    try {
      const documents = (values.documents as any) || {};
      const transformedDocuments = {
        ...documents,
        pathCedulaRepresentante: documents.pathCedulaRepresentante?.[0]?.response?.path || null,
        pathFotoRepresentante: documents.pathFotoRepresentante?.[0]?.response?.path || null,
        pathFotoEstudiante: documents.pathFotoEstudiante?.[0]?.response?.path || null,
        pathInformesMedicos: documents.pathInformesMedicos?.map((f: any) => f.response?.path).filter(Boolean) || [],
      };

      const payload = {
        ...values,
        schoolPeriodId: activePeriod.id,
        birthdate: values.birthdate ? (values.birthdate as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        enrollmentAnswers: transformAnswers(values.enrollmentAnswers as EnrollmentAnswerFormValues | undefined),
        documents: transformedDocuments
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
        enrollmentAnswers: transformAnswers(values.enrollmentAnswers as EnrollmentAnswerFormValues | undefined),
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
              {/* DATOS DEL ESTUDIANTE */}
              <div style={{ marginBottom: 24, padding: 24, background: '#fff', border: '1px solid #d9d9d9', borderRadius: 8 }}>
                <h3 style={{ borderLeft: '4px solid #faad14', paddingLeft: 12, marginBottom: 24, fontSize: 18 }}>
                  Datos del Estudiante
                </h3>

                {/* 1. IDENTIDAD */}
                <h4 style={{ color: '#1890ff', marginBottom: 16, borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
                  Identidad
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
                    <Form.Item name="document" label="Documento" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="gender" label="Género" rules={[{ required: true }]}>
                      <Radio.Group style={{ width: '100%' }}>
                        <Radio.Button value="M" style={{ width: '50%', textAlign: 'center' }}>Masculino</Radio.Button>
                        <Radio.Button value="F" style={{ width: '50%', textAlign: 'center' }}>Femenino</Radio.Button>
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
                  <Col span={8}>
                    <Form.Item
                      name="birthState"
                      label="Estado de nacimiento"
                      rules={[{ required: true, message: 'Requerido' }]}
                    >
                      <Select
                        placeholder="Estado"
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
                      rules={[{ required: true, message: 'Requerido' }]}
                    >
                      <Select
                        placeholder="Municipio"
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
                      rules={[{ required: true, message: 'Requerido' }]}
                    >
                      <Select
                        placeholder="Parroquia"
                        showSearch
                        optionFilterProp="label"
                        filterOption={selectFilterOption}
                        options={parishOptions}
                        disabled={!birthMunicipalityValue}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                {/* 2. ACADÉMICO */}
                <h4 style={{ color: '#1890ff', margin: '24px 0 16px', borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
                  Académico
                </h4>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name="gradeId"
                      label="Año que va a cursar"
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
                  <Col span={8}>
                    <Form.Item
                      name="sectionId"
                      label="Sección"
                    >
                      <Select
                        placeholder="Sección"
                        disabled={!selectedGradeId}
                        allowClear
                      >
                        {getSectionsForGrade(selectedGradeId).map((sec: Section) => (
                          <Option key={sec.id} value={sec.id}>{sec.name}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="escolaridad"
                      label="Escolaridad"
                      rules={[{ required: true }]}
                    >
                      <Select placeholder="Seleccione" options={ESCOLARIDAD_OPTIONS} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item name="previousSchoolIds" label="Plantel de procedencia">
                      <Select
                        mode="multiple"
                        placeholder="Buscar plantel..."
                        filterOption={false}
                        onSearch={searchSchools}
                        loading={loadingSchools}
                        options={schoolOptions}
                        allowClear
                        maxTagCount={1}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                {/* 3. SOCIAL */}
                <h4 style={{ color: '#1890ff', margin: '24px 0 16px', borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
                  Social
                </h4>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="pathology" label="¿Sufre alguna patología?">
                      <Input placeholder="Indique patología o 'Ninguna'" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="livingWith" label="¿Con quién vive?">
                      <Input placeholder="Ej: Madre y Padre" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item name="address" label="Dirección de habitación (Usualmente la misma del representante)" rules={[{ required: true }]}>
                      <Input.TextArea rows={2} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name="residenceState"
                      label="Estado"
                      rules={[{ required: true, message: 'Requerido' }]}
                    >
                      <Select
                        placeholder="Estado"
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
                      label="Municipio"
                      rules={[{ required: true, message: 'Requerido' }]}
                    >
                      <Select
                        placeholder="Municipio"
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
                      label="Parroquia"
                      rules={[{ required: true, message: 'Requerido' }]}
                    >
                      <Select
                        placeholder="Parroquia"
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

              {/* DATOS DEL REPRESENTANTE */}
              <div style={{ marginBottom: 32, padding: 24, background: '#fff', border: '1px solid #d9d9d9', borderRadius: 8 }}>
                <h3 style={{ borderLeft: '4px solid #fa8c16', paddingLeft: 12, marginBottom: 24, fontSize: 18 }}>
                  Datos del Representante
                </h3>



                <Form.Item
                  name="representativeType"
                  label="¿Quién ejerce la representación?"
                  rules={[{ required: true, message: 'Seleccione un representante' }]}
                >
                  <Radio.Group buttonStyle="solid">
                    <Radio.Button value="mother">La Madre</Radio.Button>
                    <Radio.Button value="father">El Padre</Radio.Button>
                    <Radio.Button value="other">Otra persona</Radio.Button>
                  </Radio.Group>
                </Form.Item>

                {/* MADRE */}
                <div style={{ background: '#fafafa', padding: 16, borderRadius: 8, marginBottom: 24, border: '1px solid #f0f0f0' }}>
                  <h4 style={{ color: '#fa8c16', marginBottom: 16 }}>
                    Datos de la Madre {motherFieldsRequired ? '(Obligatorio)' : '(Opcional)'}
                  </h4>
                  {renderGuardianDocumentControls('mother', motherFieldsRequired)}

                  {showMotherDetails && (
                    <>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name={['mother', 'firstName']} label="Nombres" rules={motherFieldsRequired ? [{ required: true }] : []}>
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name={['mother', 'lastName']} label="Apellidos" rules={motherFieldsRequired ? [{ required: true }] : []}>
                            <Input />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name={['mother', 'phone']} label="Teléfono" rules={motherFieldsRequired ? [{ required: true }] : []}>
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name={['mother', 'email']} label="Email" rules={[{ type: 'email' }]}>
                            <Input placeholder="Opcional" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item name={['mother', 'address']} label="Dirección de habitación" rules={motherFieldsRequired ? [{ required: true }] : []}>
                        <Input.TextArea rows={2} />
                      </Form.Item>
                      <Row gutter={16}>
                        <Col span={8}>
                          <Form.Item name={['mother', 'residenceState']} label="Estado" rules={motherFieldsRequired ? [{ required: true }] : []}>
                            <Select showSearch options={stateOptions} onChange={() => resetGuardianMunicipality('mother')} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item name={['mother', 'residenceMunicipality']} label="Municipio" rules={motherFieldsRequired ? [{ required: true }] : []}>
                            <Select showSearch options={motherMunicipalityOptions} onChange={() => resetGuardianParish('mother')} disabled={!motherStateValue} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item name={['mother', 'residenceParish']} label="Parroquia" rules={motherFieldsRequired ? [{ required: true }] : []}>
                            <Select showSearch options={motherParishOptions} disabled={!motherMunicipalityValue} />
                          </Form.Item>
                        </Col>
                      </Row>
                    </>
                  )}
                </div>

                {/* PADRE */}
                <div style={{ background: '#fafafa', padding: 16, borderRadius: 8, marginBottom: 24, border: '1px solid #f0f0f0' }}>
                  <h4 style={{ color: '#fa8c16', marginBottom: 16 }}>
                    Datos del Padre {fatherFieldsRequired ? '(Obligatorio)' : '(Opcional)'}
                  </h4>
                  {renderGuardianDocumentControls('father', fatherFieldsRequired)}

                  {showFatherDetails && (
                    <>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name={['father', 'firstName']} label="Nombres" rules={fatherFieldsRequired ? [{ required: true }] : []}>
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name={['father', 'lastName']} label="Apellidos" rules={fatherFieldsRequired ? [{ required: true }] : []}>
                            <Input />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name={['father', 'phone']} label="Teléfono" rules={fatherFieldsRequired ? [{ required: true }] : []}>
                            <Input />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name={['father', 'email']} label="Email" rules={[{ type: 'email' }]}>
                            <Input placeholder="Opcional" />
                          </Form.Item>
                        </Col>
                      </Row>

                      {/* Labor del padre (solo si es rep, pero lo pedimos siempre si llena datos padre?) */}
                      {/* Image says "Labor del padre (si es el representante, opcional)". I'll show it always if filling father, optional. */}
                      <Row gutter={16}>
                        <Col span={24}>
                          <Form.Item name={['father', 'occupation']} label="Labor / Ocupación">
                            <Input placeholder="Ej: Ingeniero, Comerciante..." />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item name={['father', 'address']} label="Dirección de habitación" rules={fatherFieldsRequired ? [{ required: true }] : []}>
                        <Input.TextArea rows={2} />
                      </Form.Item>
                      <Row gutter={16}>
                        <Col span={8}>
                          <Form.Item name={['father', 'residenceState']} label="Estado" rules={fatherFieldsRequired ? [{ required: true }] : []}>
                            <Select showSearch options={stateOptions} onChange={() => resetGuardianMunicipality('father')} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item name={['father', 'residenceMunicipality']} label="Municipio" rules={fatherFieldsRequired ? [{ required: true }] : []}>
                            <Select showSearch options={fatherMunicipalityOptions} onChange={() => resetGuardianParish('father')} disabled={!fatherStateValue} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item name={['father', 'residenceParish']} label="Parroquia" rules={fatherFieldsRequired ? [{ required: true }] : []}>
                            <Select showSearch options={fatherParishOptions} disabled={!fatherMunicipalityValue} />
                          </Form.Item>
                        </Col>
                      </Row>
                    </>
                  )}
                </div>

                {/* REPRESENTANTE (Si es otro) */}
                {representativeIsOther && (
                  <div style={{ background: '#fff7e6', padding: 16, borderRadius: 8, marginBottom: 24, border: '1px solid #ffd591' }}>
                    <h4 style={{ color: '#d46b08', marginBottom: 16 }}>
                      Datos del Representante {representativeFieldsRequired ? '(Obligatorio)' : '(Opcional)'}
                    </h4>
                    {renderGuardianDocumentControls('representative', representativeFieldsRequired)}

                    {showRepresentativeDetails && (
                      <>
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item name={['representative', 'firstName']} label="Nombres" rules={representativeFieldsRequired ? [{ required: true }] : []}>
                              <Input />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name={['representative', 'lastName']} label="Apellidos" rules={representativeFieldsRequired ? [{ required: true }] : []}>
                              <Input />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item name={['representative', 'phone']} label="Teléfono" rules={representativeFieldsRequired ? [{ required: true }] : []}>
                              <Input />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name={['representative', 'email']} label="Email" rules={[{ type: 'email' }]}>
                              <Input placeholder="Opcional" />
                            </Form.Item>
                          </Col>
                        </Row>

                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item name={['representative', 'occupation']} label="Labor / Ocupación">
                              <Input />
                            </Form.Item>
                          </Col>
                        </Row>

                        <Form.Item name={['representative', 'address']} label="Dirección de habitación" rules={representativeFieldsRequired ? [{ required: true }] : []}>
                          <Input.TextArea rows={2} />
                        </Form.Item>
                        <Row gutter={16}>
                          <Col span={8}>
                            <Form.Item name={['representative', 'residenceState']} label="Estado" rules={representativeFieldsRequired ? [{ required: true }] : []}>
                              <Select showSearch options={stateOptions} onChange={() => resetGuardianMunicipality('representative')} />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item name={['representative', 'residenceMunicipality']} label="Municipio" rules={representativeFieldsRequired ? [{ required: true }] : []}>
                              <Select showSearch options={representativeMunicipalityOptions} onChange={() => resetGuardianParish('representative')} disabled={!representativeStateValue} />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item name={['representative', 'residenceParish']} label="Parroquia" rules={representativeFieldsRequired ? [{ required: true }] : []}>
                              <Select showSearch options={representativeParishOptions} disabled={!representativeMunicipalityValue} />
                            </Form.Item>
                          </Col>
                        </Row>
                      </>
                    )}
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



              {/* DOCUMENTOS */}
              <div style={{ marginBottom: 32, padding: 24, background: '#fff', border: '1px solid #d9d9d9', borderRadius: 8 }}>
                <h3 style={{ borderLeft: '4px solid #fa8c16', paddingLeft: 12, marginBottom: 24, fontSize: 18 }}>
                  Documentos Consignados
                </h3>
                <Row gutter={[16, 16]}>
                  <Col span={12}><Form.Item name={['documents', 'receivedCertificadoAprendizaje']} valuePropName="checked"><Checkbox>Certificado de aprendizaje</Checkbox></Form.Item></Col>
                  <Col span={12}><Form.Item name={['documents', 'receivedCartaBuenaConducta']} valuePropName="checked"><Checkbox>Carta de buena conducta</Checkbox></Form.Item></Col>
                  <Col span={12}><Form.Item name={['documents', 'receivedNotasCertificadas']} valuePropName="checked"><Checkbox>Notas certificadas (de 2do año en adelante)</Checkbox></Form.Item></Col>
                  <Col span={12}><Form.Item name={['documents', 'receivedPartidaNacimiento']} valuePropName="checked"><Checkbox>Partida de nacimiento</Checkbox></Form.Item></Col>
                  <Col span={12}><Form.Item name={['documents', 'receivedCopiaCedulaEstudiante']} valuePropName="checked"><Checkbox>Fotocopia de cédula del estudiante</Checkbox></Form.Item></Col>
                  <Col span={12}><Form.Item name={['documents', 'receivedInformesMedicos']} valuePropName="checked"><Checkbox>Informes médicos (si tiene alguno)</Checkbox></Form.Item></Col>
                  <Col span={12}><Form.Item name={['documents', 'receivedFotoCarnetEstudiante']} valuePropName="checked"><Checkbox>Foto tipo carnet del estudiante</Checkbox></Form.Item></Col>
                </Row>

                <h4 style={{ marginTop: 24, marginBottom: 16 }}>Archivos Digitales</h4>
                <Row gutter={24}>
                  <Col span={8}>
                    <Form.Item name={['documents', 'pathCedulaRepresentante']} label="Cédula Representante" getValueFromEvent={normFile}>
                      <Upload
                        action="/api/upload/documents"
                        maxCount={1}
                        listType="picture-card"
                        accept="image/*"
                        showUploadList={{ showRemoveIcon: true }}
                        onPreview={handlePreview}
                      >
                        <div>
                          <UploadOutlined />
                          <div style={{ marginTop: 8 }}>Subir</div>
                        </div>
                      </Upload>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name={['documents', 'pathFotoRepresentante']} label="Foto Representante" getValueFromEvent={normFile}>
                      <Upload
                        action="/api/upload/documents"
                        maxCount={1}
                        listType="picture-card"
                        accept="image/*"
                        showUploadList={{ showRemoveIcon: true }}
                        onPreview={handlePreview}
                      >
                        <div>
                          <UploadOutlined />
                          <div style={{ marginTop: 8 }}>Subir</div>
                        </div>
                      </Upload>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name={['documents', 'pathFotoEstudiante']} label="Foto Estudiante" getValueFromEvent={normFile}>
                      <Upload
                        action="/api/upload/documents"
                        maxCount={1}
                        listType="picture-card"
                        accept="image/*"
                        showUploadList={{ showRemoveIcon: true }}
                        onPreview={handlePreview}
                      >
                        <div>
                          <UploadOutlined />
                          <div style={{ marginTop: 8 }}>Subir</div>
                        </div>
                      </Upload>
                    </Form.Item>
                  </Col>
                </Row>

                {receivedInformesMedicos && (
                  <Row gutter={24} style={{ marginTop: 16 }}>
                    <Col span={24}>
                      <Form.Item name={['documents', 'pathInformesMedicos']} label="Informes Médicos (Imágenes)" getValueFromEvent={normFile}>
                        <Upload
                          action="/api/upload/documents"
                          listType="picture-card"
                          accept="image/*"
                          multiple
                          showUploadList={{ showRemoveIcon: true }}
                          onPreview={handlePreview}
                        >
                          <div>
                            <UploadOutlined />
                            <div style={{ marginTop: 8 }}>Subir</div>
                          </div>
                        </Upload>
                      </Form.Item>
                    </Col>
                  </Row>
                )}
              </div>

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
                  showSearch
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

      <Modal open={previewOpen} title={previewTitle} footer={null} onCancel={handleCancelPreview}>
        <img alt="example" style={{ width: '100%' }} src={previewImage} />
      </Modal>
    </div >
  );
};

export default EnrollStudent;
