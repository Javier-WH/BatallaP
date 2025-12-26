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
  Modal,
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
import { getEnrollmentQuestionsForPerson } from '@/services/enrollmentQuestions';
import type { EnrollmentQuestionResponse } from '@/services/enrollmentQuestions';
import EnrollmentQuestionFields from '@/components/EnrollmentQuestionFields';
import type { GuardianDocumentType } from '@/services/guardians';

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
  documentType?: GuardianDocumentType;
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
  documentType?: GuardianDocumentType;
  document?: string;
  phone?: string;
  email?: string;
  residenceState?: string;
  residenceMunicipality?: string;
  residenceParish?: string;
  address?: string;
}

type RepresentativeType = 'mother' | 'father' | 'other';

type EnrollmentAnswerFormValues = Record<number, string | string[]>;

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
  enrollmentAnswers?: EnrollmentAnswerFormValues;
}

type SchoolSearchResult = {
  code?: string;
  name: string;
  state: string;
};

const guardianDocumentOptions: { label: string; value: GuardianDocumentType }[] = [
  { label: 'Venezolano', value: 'Venezolano' },
  { label: 'Extranjero', value: 'Extranjero' },
  { label: 'Pasaporte', value: 'Pasaporte' }
];

const guardianLabels: Record<GuardianRelationship, string> = {
  mother: 'la madre',
  father: 'el padre',
  representative: 'el representante'
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
  const [enrollmentQuestions, setEnrollmentQuestions] = useState<EnrollmentQuestionResponse[]>([]);

  // Previous schools state
  const [previousSchoolsLoading, setPreviousSchoolsLoading] = useState(false);
  const [schoolOptions, setSchoolOptions] = useState<{ label: string; value: string }[]>([]);
  const [showAddSchool, setShowAddSchool] = useState(false);
  const [currentSearchQuery, setCurrentSearchQuery] = useState('');

  // Guardian search state
  const [guardianSearchLoading, setGuardianSearchLoading] = useState<{ [key: string]: boolean }>({});
  const [guardianSearchResults, setGuardianSearchResults] = useState<{ [key: string]: GuardianInfo | null }>({});
  const [guardianSearchStatus, setGuardianSearchStatus] = useState<{ [key: string]: 'idle' | 'loading' | 'found' | 'not_found' }>({});

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

  // Guardian document watchers
  const motherDocumentType = Form.useWatch(['mother', 'documentType'], form);
  const motherDocument = Form.useWatch(['mother', 'document'], form);
  const fatherDocumentType = Form.useWatch(['father', 'documentType'], form);
  const fatherDocument = Form.useWatch(['father', 'document'], form);
  const representativeDocumentType = Form.useWatch(['representative', 'documentType'], form);
  const representativeDocument = Form.useWatch(['representative', 'document'], form);

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
          setEnrollmentQuestions([]);
          setGuardianSearchResults({});
          setGuardianSearchStatus({});
          form.setFieldsValue({
            enrollmentAnswers: {},
            mother: { documentType: 'Venezolano' },
            father: { documentType: undefined },
            representative: { documentType: 'Venezolano' }
          });
          form.resetFields();
        }
      } catch (error) {
        console.error(error);
        message.error('Error cargando matriculados');
      } finally {
        setListLoading(false);
      }
    },
    [form],
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

  const handleAddSchool = async (schoolData: { name: string; code: string; state: string }) => {
    try {
      const response = await api.post('/planteles', schoolData);
      const newSchool = response.data;

      // Add the new school to the current options
      const newOption = {
        label: `${newSchool.name} (${newSchool.code})`,
        value: newSchool.code || newSchool.name
      };

      setSchoolOptions(prev => [...prev, newOption]);
      setShowAddSchool(false);

      message.success('Plantel agregado exitosamente');

      // Optionally, you could refresh the search or clear the current search
      // setCurrentSearchQuery('');
    } catch (error) {
      console.error('Error adding school:', error);
      message.error('Error agregando plantel');
    }
  };

  const searchSchools = async (query: string) => {
    setCurrentSearchQuery(query);

    if (!query || query.length < 2) {
      setSchoolOptions([]);
      setShowAddSchool(false);
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
      // Don't automatically show modal - let user click button
    } catch (error) {
      console.error('Error searching schools:', error);
      message.error('Error buscando planteles');
      setSchoolOptions([]);
    } finally {
      setPreviousSchoolsLoading(false);
    }
  };

  const searchGuardian = useCallback(async (guardianKey: GuardianRelationship, documentType: GuardianDocumentType, document: string) => {
    if (!documentType || !document || document.length < 3) {
      setGuardianSearchResults(prev => ({ ...prev, [guardianKey]: null }));
      setGuardianSearchStatus(prev => ({ ...prev, [guardianKey]: 'idle' }));
      return;
    }

    setGuardianSearchLoading(prev => ({ ...prev, [guardianKey]: true }));
    setGuardianSearchStatus(prev => ({ ...prev, [guardianKey]: 'loading' }));

    try {
      const response = await api.get('/guardians/search', {
        params: { documentType, document }
      });

      if (response.data) {
        setGuardianSearchResults(prev => ({ ...prev, [guardianKey]: response.data }));
        setGuardianSearchStatus(prev => ({ ...prev, [guardianKey]: 'found' }));

        // Auto-fill form with found guardian data
        const guardian = response.data;
        form.setFieldsValue({
          [guardianKey]: {
            firstName: guardian.firstName,
            lastName: guardian.lastName,
            documentType: guardian.documentType,
            document: guardian.document,
            phone: guardian.phone,
            email: guardian.email,
            residenceState: guardian.residenceState,
            residenceMunicipality: guardian.residenceMunicipality,
            residenceParish: guardian.residenceParish,
            address: guardian.address
          }
        });
        message.success(`Datos de ${guardianLabels[guardianKey]} encontrados`);
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const err = error as { response?: { status?: number } };
        if (err.response?.status === 404) {
          setGuardianSearchResults(prev => ({ ...prev, [guardianKey]: null }));
          setGuardianSearchStatus(prev => ({ ...prev, [guardianKey]: 'not_found' }));
          // message.info('Representante no registrado...');
          const currentValues = form.getFieldValue(guardianKey) || {};
          form.setFieldsValue({
            [guardianKey]: {
              firstName: undefined,
              lastName: undefined,
              phone: undefined,
              email: undefined,
              residenceState: undefined,
              residenceMunicipality: undefined,
              residenceParish: undefined,
              address: undefined,
              documentType: currentValues.documentType || documentType,
              document: currentValues.document || document
            }
          });
        } else {
          console.error('Error searching guardian:', error);
          message.error('Error buscando representante');
          setGuardianSearchStatus(prev => ({ ...prev, [guardianKey]: 'idle' })); // Reset on error?
        }
      } else {
        console.error('Error searching guardian:', error);
        message.error('Error buscando representante');
        setGuardianSearchStatus(prev => ({ ...prev, [guardianKey]: 'idle' }));
      }
    } finally {
      setGuardianSearchLoading(prev => ({ ...prev, [guardianKey]: false }));
    }
  }, [form]);

  const loadEnrollmentQuestions = useCallback(
    async (personId: number) => {
      try {
        const data = await getEnrollmentQuestionsForPerson(personId);
        setEnrollmentQuestions(data);
        const answers: EnrollmentAnswerFormValues = {};
        data.forEach((question) => {
          if (question.answer !== null && question.answer !== undefined) {
            answers[question.id] = question.answer as string | string[];
          }
        });
        form.setFieldsValue({
          enrollmentAnswers: answers
        });
      } catch (error) {
        console.error('Error loading enrollment questions:', error);
        message.error('No se pudieron cargar las preguntas dinámicas');
        setEnrollmentQuestions([]);
      }
    },
    [form]
  );

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

        setGuardianSearchResults({
          mother: mother || null,
          father: father || null,
          representative: representative || null
        });

        setGuardianSearchStatus({
          mother: mother ? 'found' : 'idle',
          father: father ? 'found' : 'idle',
          representative: representative ? 'found' : 'idle'
        });

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
              documentType: mother.documentType || 'Venezolano',
              document: mother.document,
              phone: mother.phone,
              email: mother.email,
              residenceState: mother.residenceState,
              residenceMunicipality: mother.residenceMunicipality,
              residenceParish: mother.residenceParish,
              address: mother.address
            }
            : { documentType: 'Venezolano' },
          father: father
            ? {
              firstName: father.firstName,
              lastName: father.lastName,
              documentType: father.documentType || 'Venezolano',
              document: father.document,
              phone: father.phone,
              email: father.email,
              residenceState: father.residenceState,
              residenceMunicipality: father.residenceMunicipality,
              residenceParish: father.residenceParish,
              address: father.address
            }
            : { documentType: undefined },
          representative: representative
            ? {
              firstName: representative.firstName,
              lastName: representative.lastName,
              documentType: representative.documentType || 'Venezolano',
              document: representative.document,
              phone: representative.phone,
              email: representative.email,
              residenceState: representative.residenceState,
              residenceMunicipality: representative.residenceMunicipality,
              residenceParish: representative.residenceParish,
              address: representative.address
            }
            : { documentType: 'Venezolano' },
          previousSchoolIds: data.student.previousSchools?.map((s: any) => s.plantelCode || s.plantelName) || [],
        });

        await loadEnrollmentQuestions(data.student.id);
      } catch (error) {
        console.error(error);
        message.error('No se pudo cargar la matriculación seleccionada');
      } finally {
        setDetailLoading(false);
      }
    },
    [fetchStructure, form, loadEnrollmentQuestions]
  );

  useEffect(() => {
    fetchMatriculations();
    fetchLocations();
  }, [fetchMatriculations, fetchLocations]);

  // Auto-search guardians when document fields change
  useEffect(() => {
    if (motherDocumentType && motherDocument && motherDocument.length >= 6) {
      const timeoutId = setTimeout(() => {
        searchGuardian('mother', motherDocumentType, motherDocument);
      }, 500); // Debounce 500ms
      return () => clearTimeout(timeoutId);
    }
  }, [motherDocumentType, motherDocument, searchGuardian]);

  useEffect(() => {
    if (fatherDocumentType && fatherDocument && fatherDocument.length >= 6) {
      const timeoutId = setTimeout(() => {
        searchGuardian('father', fatherDocumentType, fatherDocument);
      }, 500); // Debounce 500ms
      return () => clearTimeout(timeoutId);
    }
  }, [fatherDocumentType, fatherDocument, searchGuardian]);

  useEffect(() => {
    if (representativeDocumentType && representativeDocument && representativeDocument.length >= 6) {
      const timeoutId = setTimeout(() => {
        searchGuardian('representative', representativeDocumentType, representativeDocument);
      }, 500); // Debounce 500ms
      return () => clearTimeout(timeoutId);
    }
  }, [representativeDocumentType, representativeDocument, searchGuardian]);

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

  const renderGuardianDocumentControls = (guardianKey: GuardianRelationship, required: boolean) => {
    const isLoading = guardianSearchLoading[guardianKey];
    const searchResult = guardianSearchResults[guardianKey];

    return (
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
            label="Cédula"
            help={searchResult ? `Representante encontrado: ${searchResult.firstName} ${searchResult.lastName}` : null}
            validateStatus={searchResult ? 'success' : undefined}
            rules={
              required ? [{ required: true, message: `Ingrese la cédula de ${guardianLabels[guardianKey]}` }] : []
            }
          >
            <Input
              placeholder="Número de cédula"
              suffix={isLoading ? <Spin size="small" /> : searchResult ? <UserAddOutlined style={{ color: '#52c41a' }} /> : <SearchOutlined style={{ color: '#bfbfbf' }} />}
            />
          </Form.Item>
        </Col>
      </Row>
    );
  };

  const renderGuardianFields = (guardianKey: 'mother' | 'father' | 'representative', required: boolean) => {
    const status = guardianSearchStatus[guardianKey];
    const searchResult = guardianSearchResults[guardianKey];
    const showDetails = status === 'found' || status === 'not_found';
    // Only disable if status is found AND the specific field has a value in the search result
    const isFieldReadOnly = (fieldName: keyof GuardianInfo) => status === 'found' && !!searchResult?.[fieldName];

    if (!showDetails) return null;

    const municipalityOptions = {
      mother: motherMunicipalityOptions,
      father: fatherMunicipalityOptions,
      representative: representativeMunicipalityOptions
    }[guardianKey];

    const parishOptions = {
      mother: motherParishOptions,
      father: fatherParishOptions,
      representative: representativeParishOptions
    }[guardianKey];

    const stateValue = {
      mother: motherStateValue,
      father: fatherStateValue,
      representative: representativeStateValue
    }[guardianKey];

    const municipalityValue = {
      mother: motherMunicipalityValue,
      father: fatherMunicipalityValue,
      representative: representativeMunicipalityValue
    }[guardianKey];

    return (
      <>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name={[guardianKey, 'firstName']}
              label="Nombres"
              rules={required ? [{ required: true, message: `Ingrese los nombres de ${guardianLabels[guardianKey]}` }] : []}
            >
              <Input disabled={isFieldReadOnly('firstName')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name={[guardianKey, 'lastName']}
              label="Apellidos"
              rules={required ? [{ required: true, message: `Ingrese los apellidos de ${guardianLabels[guardianKey]}` }] : []}
            >
              <Input disabled={isFieldReadOnly('lastName')} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name={[guardianKey, 'phone']}
              label="Teléfono"
              rules={required ? [{ required: true, message: `Ingrese el teléfono de ${guardianLabels[guardianKey]}` }] : []}
            >
              <Input disabled={isFieldReadOnly('phone')} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name={[guardianKey, 'email']}
              label="Email"
              rules={
                required
                  ? [
                    { required: true, message: `Ingrese el email de ${guardianLabels[guardianKey]}` },
                    { type: 'email', message: 'Email inválido' }
                  ]
                  : [{ type: 'email', message: 'Email inválido' }]
              }
            >
              <Input disabled={isFieldReadOnly('email')} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name={[guardianKey, 'residenceState']}
              label="Estado de residencia"
              rules={required ? [{ required: true, message: 'Seleccione el estado' }] : []}
            >
              <Select
                placeholder="Seleccione estado"
                showSearch
                optionFilterProp="label"
                filterOption={selectFilterOption}
                options={stateOptions}
                onChange={() => resetGuardianMunicipality(guardianKey)}
                disabled={isFieldReadOnly('residenceState')}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name={[guardianKey, 'residenceMunicipality']}
              label="Municipio de residencia"
              rules={required ? [{ required: true, message: 'Seleccione el municipio' }] : []}
            >
              <Select
                placeholder="Seleccione municipio"
                showSearch
                optionFilterProp="label"
                filterOption={selectFilterOption}
                options={municipalityOptions}
                disabled={isFieldReadOnly('residenceMunicipality') || !stateValue}
                onChange={() => resetGuardianParish(guardianKey)}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name={[guardianKey, 'residenceParish']}
              label="Parroquia de residencia"
              rules={required ? [{ required: true, message: 'Seleccione la parroquia' }] : []}
            >
              <Select
                placeholder="Seleccione parroquia"
                showSearch
                optionFilterProp="label"
                filterOption={selectFilterOption}
                options={parishOptions}
                disabled={isFieldReadOnly('residenceParish') || !municipalityValue}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row>
          <Col span={24}>
            <Form.Item
              name={[guardianKey, 'address']}
              label="Dirección"
              rules={required ? [{ required: true, message: 'Ingrese la dirección' }] : []}
            >
              <Input.TextArea rows={2} disabled={isFieldReadOnly('address')} />
            </Form.Item>
          </Col>
        </Row>
      </>
    );
  };

  const motherIsRepresentative = representativeTypeValue === 'mother';
  const fatherIsRepresentative = representativeTypeValue === 'father';
  const representativeIsOther = representativeTypeValue === 'other';
  const requireRepresentativeData = representativeIsOther || (!motherIsRepresentative && !fatherIsRepresentative);
  const fatherDataRequired = !!fatherIsRepresentative;

  const transformAnswers = (raw?: EnrollmentAnswerFormValues) => {
    if (!raw) return [];
    return Object.entries(raw).map(([id, answer]) => ({
      questionId: Number(id),
      answer
    }));
  };

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
        previousSchoolIds: values.previousSchoolIds || [],
        enrollmentAnswers: transformAnswers(values.enrollmentAnswers)
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
      <Card variant="borderless" style={{ height: '100%' }}>
        <div style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.4, color: '#4a4a4a', textTransform: 'uppercase' }}>
            Estudiantes por Matricular
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
        title="Proceso de Matrícula"
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
            initialValues={{
              documentType: 'Venezolano',
              gender: 'M',
              representativeType: 'mother',
              mother: { documentType: 'Venezolano' },
              father: { documentType: undefined },
              representative: { documentType: 'Venezolano' }
            }}
          >
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 20 }}
              title="Datos pre-cargados"
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
                          : !schoolOptions.length && currentSearchQuery && currentSearchQuery.length >= 2
                            ? <div style={{ padding: 8 }}>
                              <div style={{ marginBottom: 8, color: '#666' }}>
                                No se encontraron planteles con "{currentSearchQuery}"
                              </div>
                              <Button
                                type="link"
                                size="small"
                                onClick={() => setShowAddSchool(true)}
                                style={{ padding: 0 }}
                              >
                                + Agregar nuevo plantel
                              </Button>
                            </div>
                            : <div style={{ padding: 8, color: '#999' }}>Escriba al menos 2 caracteres para buscar</div>
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
                {renderGuardianDocumentControls('mother', true)}
                {renderGuardianFields('mother', true)}
              </div>

              <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: 16, marginBottom: 24 }}>
                <h5 style={{ marginBottom: 16 }}>
                  Padre {fatherDataRequired ? '(obligatorio)' : '(opcional)'}
                </h5>
                {renderGuardianDocumentControls('father', fatherDataRequired)}
                {renderGuardianFields('father', fatherDataRequired)}
              </div>

              {representativeIsOther && (
                <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: 16 }}>
                  <h5 style={{ marginBottom: 16 }}>
                    Representante {requireRepresentativeData ? '(obligatorio)' : '(opcional)'}
                  </h5>
                  {renderGuardianDocumentControls('representative', requireRepresentativeData)}
                  {renderGuardianFields('representative', requireRepresentativeData)}
                </div>
              )}
            </div>

            {Boolean(enrollmentQuestions.length) && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#666', borderBottom: '1px solid #eee', paddingBottom: 8 }}>
                  6. Preguntas adicionales del plantel
                </h4>
                <EnrollmentQuestionFields questions={enrollmentQuestions} parentName="enrollmentAnswers" />
              </div>
            )}

            <Form.Item style={{ marginTop: 24, textAlign: 'right' }}>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<UserAddOutlined />}
                  size="large"
                  loading={submitting}
                >
                  Matricular Estudiante
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Card>

      {/* Add School Modal */}
      <Modal
        title="Agregar Nuevo Plantel"
        open={showAddSchool}
        onCancel={() => setShowAddSchool(false)}
        footer={null}
        destroyOnHidden
      >
        <Form
          layout="vertical"
          onFinish={handleAddSchool}
          initialValues={{
            name: currentSearchQuery,
            state: '',
            code: '',
            dependency: 'Público'
          }}
        >
          <Form.Item
            name="name"
            label="Nombre del Plantel"
            rules={[{ required: true, message: 'Ingrese el nombre del plantel' }]}
          >
            <Input placeholder="Ej: Escuela Nacional República de Colombia" />
          </Form.Item>

          <Form.Item
            name="code"
            label="Código del Plantel"
            rules={[{ required: true, message: 'Ingrese el código del plantel' }]}
          >
            <Input placeholder="Ej: 012345" />
          </Form.Item>

          <Form.Item
            name="state"
            label="Estado"
            rules={[{ required: true, message: 'Seleccione el estado' }]}
          >
            <Select placeholder="Seleccione estado">
              {locations.map((state) => (
                <Option key={state.estado} value={state.estado}>
                  {state.estado}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="dependency"
            label="Dependencia"
          >
            <Select placeholder="Seleccione dependencia">
              <Option value="Público">Público</Option>
              <Option value="Privado">Privado</Option>
              <Option value="Subvencionado">Subvencionado</Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setShowAddSchool(false)}>
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit">
                Agregar Plantel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MatriculationEnrollment;
