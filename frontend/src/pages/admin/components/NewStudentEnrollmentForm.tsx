import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Form, message, Select, Row, Col, Input, DatePicker, Radio, Alert, Checkbox, Upload, Modal, Tag, Button } from 'antd';
import type { UploadFile, RcFile, UploadChangeParam } from 'antd/es/upload/interface';
import { UserAddOutlined, LoadingOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { parseDateLocal } from '@/utils/dateHelpers';
import api from '@/services/api';
import { ensurePreinscriptionPeriod } from '@/services/academic';
import EnrollmentQuestionFields from '@/components/EnrollmentQuestionFields';
import { getEnrollmentQuestions } from '@/services/enrollmentQuestions';
import type { EnrollmentQuestionResponse } from '@/services/enrollmentQuestions';
import { searchGuardian } from '@/services/guardians';
import type { GuardianDocumentType, GuardianProfileResponse } from '@/services/guardians';
import EnrollmentReportModal from '@/components/pdf/EnrollmentReportModal';

const { Option } = Select;

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

type SchoolPeriodStatus = 'preinscripcion' | 'activo' | 'historico' | 'externo';

type SchoolPeriod = {
  id: number;
  period: string;
  name: string;
  startYear: number;
  endYear: number;
  status: SchoolPeriodStatus;
  isActive: boolean;
};

type Section = {
  id: number;
  name: string;
  PeriodGradeSection?: { id: number };
};

type EnrollStructureItem = {
  id: number;
  gradeId: number;
  schoolPeriodId: number;
  specializationId?: number | null;
  grade?: { id: number; name: string };
  sections?: Section[];
  subjects?: { id: number; name: string; PeriodGradeSubject?: { id: number; order: number }; subjectGroup?: { id: number; name: string } }[];
};

type GuardianData = {
  firstName?: string;
  lastName?: string;
  documentType?: GuardianDocumentType;
  document?: string;
  phone?: string;
  phone2?: string;
  whatsapp?: string;
  email?: string;
  residenceState?: string;
  residenceMunicipality?: string;
  residenceParish?: string;
  address?: string;
  birthdate?: dayjs.Dayjs;
};

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
  phone2: profile.phone2,
  whatsapp: profile.whatsapp,
  email: profile.email,
  residenceState: profile.residenceState,
  residenceMunicipality: profile.residenceMunicipality,
  residenceParish: profile.residenceParish,
  address: profile.address,
  birthdate: profile.birthdate ? parseDateLocal(profile.birthdate) ?? undefined : undefined
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

type DocumentUploadResponse = {
  path?: string;
};

type EnrollmentDocumentsFormValues = {
  receivedCertificadoAprendizaje?: boolean;
  receivedCartaBuenaConducta?: boolean;
  receivedNotasCertificadas?: boolean;
  receivedPartidaNacimiento?: boolean;
  receivedCopiaCedulaEstudiante?: boolean;
  receivedInformesMedicos?: boolean;
  receivedFotoCarnetEstudiante?: boolean;
  pathCedulaRepresentante?: UploadFile<DocumentUploadResponse>[];
  pathFotoRepresentante?: UploadFile<DocumentUploadResponse>[];
  pathFotoEstudiante?: UploadFile<DocumentUploadResponse>[];
  pathInformesMedicos?: UploadFile<DocumentUploadResponse>[];
};

type NewStudentFormValues = Record<string, unknown> & {
  documents?: EnrollmentDocumentsFormValues;
  birthdate?: dayjs.Dayjs;
  enrollmentAnswers?: EnrollmentAnswerFormValues;
};

const transformAnswers = (raw?: EnrollmentAnswerFormValues) => {
  if (!raw) return [];
  return Object.entries(raw).map(([key, value]) => ({
    questionId: Number(key),
    answer: value
  }));
};

const normFile = (
  e: UploadChangeParam<UploadFile<DocumentUploadResponse>> | UploadFile<DocumentUploadResponse>[]
) => {
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

const selectFilterOption = (input: string, option?: { label?: string }) =>
  (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase());

export interface NewStudentEnrollmentFormProps {
  mode: 'inscripcion' | 'preinscripcion';
  allPeriods: SchoolPeriod[];
  venezuelaLocations: VenezuelaState[];
  onPeriodsChanged?: () => void;
}

const NewStudentEnrollmentForm: React.FC<NewStudentEnrollmentFormProps> = ({
  mode,
  allPeriods,
  venezuelaLocations,
  onPeriodsChanged,
}) => {
  const isPreinscription = mode === 'preinscripcion';

  // State
  const [newStudentForm] = Form.useForm();
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [enrollStructure, setEnrollStructure] = useState<EnrollStructureItem[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [schoolOptions, setSchoolOptions] = useState<OptionItem[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [enrollmentQuestions, setEnrollmentQuestions] = useState<EnrollmentQuestionResponse[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [guardianLookupLoading, setGuardianLookupLoading] = useState<GuardianKey | null>(null);
  const guardianLookupCache = React.useRef<Record<GuardianKey, string>>({
    mother: '',
    father: '',
    representative: ''
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportUuid, setReportUuid] = useState<string | null>(null);
  const [creatingPreinscription, setCreatingPreinscription] = useState(false);
  const [preinscriptionMissing, setPreinscriptionMissing] = useState(false);

  // Form watches
  const representativeTypeValue = Form.useWatch('representativeType', newStudentForm);
  const studentDocumentType = Form.useWatch('documentType', newStudentForm);
  const studentDocumentValue = Form.useWatch('document', newStudentForm);
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

  // Load period (active for inscripcion, preinscripcion for preinscripcion) and structure on mount
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const targetStatus = isPreinscription ? 'preinscripcion' : 'activo';
        const target = allPeriods.find((p) => p.status === targetStatus);

        if (!target) {
          if (isPreinscription) {
            setPreinscriptionMissing(true);
          } else {
            message.warning('No hay periodo escolar activo configurado');
          }
          setLoading(false);
          return;
        }

        setPreinscriptionMissing(false);
        setSelectedPeriodId(target.id);

        const structureRes = await api.get(`/academic/structure/${target.id}`);
        setEnrollStructure(structureRes.data);

        setQuestionsLoading(true);
        const dynamicQuestions = await getEnrollmentQuestions(false);
        setEnrollmentQuestions(dynamicQuestions);
      } catch (error) {
        console.log(error);
        message.error('Error cargando datos del período');
      } finally {
        setLoading(false);
        setQuestionsLoading(false);
      }
    };
    init();
  }, [allPeriods, isPreinscription]);

  const handleCreatePreinscription = async () => {
    setCreatingPreinscription(true);
    try {
      await ensurePreinscriptionPeriod();
      message.success('Período de preinscripción creado correctamente');
      onPeriodsChanged?.();
    } catch (error) {
      console.error('Error creando período de preinscripción:', error);
      const err = error as { response?: { data?: { error?: string; message?: string } } };
      message.error(err.response?.data?.error || err.response?.data?.message || 'No se pudo crear el período de preinscripción');
    } finally {
      setCreatingPreinscription(false);
    }
  };

  const handlePeriodChange = async (periodId: number) => {
    setSelectedPeriodId(periodId);
    setSelectedGradeId(null);
    newStudentForm.setFieldsValue({ gradeId: undefined, sectionId: undefined });
    try {
      const structureRes = await api.get(`/academic/structure/${periodId}`);
      setEnrollStructure(structureRes.data);
    } catch {
      message.error('Error al cargar estructura del período');
    }
  };

  const searchSchools = async (query: string) => {
    if (!query || query.length < 2) {
      setSchoolOptions([]);
      return;
    }

    setLoadingSchools(true);
    try {
      const response = await api.get(`/planteles/search?q=${encodeURIComponent(query)}`);
      const options = response.data.map((school: SchoolSearchResult) => ({
        label: `${school.name} - ${school.state} (${school.code})`,
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

      if (!cacheKey) {
        guardianLookupCache.current[guardianKey] = '';
        return;
      }

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
        }
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
  const representativeIsOther = !motherIsRepresentative && !fatherIsRepresentative;

  const motherFieldsRequired = motherIsRepresentative
    || (studentDocumentType === 'Cedula Escolar' && !studentDocumentValue);
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

  const handleCancelPreview = () => setPreviewOpen(false);

  const handlePreview = async (file: UploadFile) => {
    if (!file.url && !file.preview) {
      file.preview = await getBase64(file.originFileObj as RcFile);
    }

    let url = file.url || (file.preview as string);
    // url is already relative or base64, no need to prefix with backend host

    setPreviewImage(url);
    setPreviewOpen(true);
    setPreviewTitle(file.name || url.substring(url.lastIndexOf('/') + 1));
  };

  const handleNewStudentSubmit = async (values: NewStudentFormValues) => {
    if (!selectedPeriodId) {
      message.error(isPreinscription ? 'No hay período de preinscripción' : 'No hay periodo activo');
      return;
    }

    try {
      const documents: EnrollmentDocumentsFormValues = values.documents ?? {};
      const transformedDocuments = {
        ...documents,
        pathCedulaRepresentante: documents.pathCedulaRepresentante?.[0]?.response?.path ?? null,
        pathFotoRepresentante: documents.pathFotoRepresentante?.[0]?.response?.path ?? null,
        pathFotoEstudiante: documents.pathFotoEstudiante?.[0]?.response?.path ?? null,
        pathInformesMedicos:
          documents.pathInformesMedicos
            ?.map((file) => file.response?.path)
            .filter((path): path is string => Boolean(path)) ?? [],
      };

      const syncGuardianPhone = (g: GuardianData | undefined) => {
        if (!g) return undefined;
        const { birthdate, ...rest } = g;
        return {
          ...rest,
          phone: g.whatsapp || g.phone || '',
          birthdate: birthdate ? (birthdate as dayjs.Dayjs).format('YYYY-MM-DD') : null
        };
      };

      const payload = {
        ...values,
        pathology: values.pathology === 'ninguna' ? null : (values.pathology === 'otra' ? (values.customPathology as string) : values.pathology),
        livingWith: values.livingWith === 'otro' ? (values.customLivingWith as string) : values.livingWith,
        document: (() => {
          const docType = values.documentType as string;
          const doc = values.document as string;
          const nationality = values.nationality as string;
          if (docType === 'Pasaporte') return doc;
          if (docType === 'Cedula Escolar') {
            if (nationality === 'Venezolano') return doc ? `V${doc}` : doc;
            if (nationality === 'Extranjero') return doc ? `E${doc}` : doc;
            return doc;
          }
          if (docType === 'Venezolano') return doc ? `V${doc}` : doc;
          if (docType === 'Extranjero') return doc ? `E${doc}` : doc;
          return doc;
        })(),
        schoolPeriodId: selectedPeriodId,
        birthdate: values.birthdate ? (values.birthdate as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        mother: syncGuardianPhone(values.mother as GuardianData | undefined),
        father: syncGuardianPhone(values.father as GuardianData | undefined),
        representative: syncGuardianPhone(values.representative as GuardianData | undefined),
        enrollmentAnswers: transformAnswers(values.enrollmentAnswers as EnrollmentAnswerFormValues | undefined),
        documents: transformedDocuments
      };

      const response = await api.post('/inscriptions/register', payload);
      const reportUuid = response.data?.reportUuid as string | undefined;

      message.success(isPreinscription ? 'Preinscripción registrada exitosamente' : 'Solicitud de inscripción registrada exitosamente');
      newStudentForm.resetFields();
      setSelectedGradeId(null);

      if (reportUuid) {
        Modal.confirm({
          title: isPreinscription ? 'Preinscripción exitosa' : 'Inscripción exitosa',
          content: '¿Desea generar e imprimir la planilla de inscripción?',
          okText: 'Sí, ver planilla',
          cancelText: 'No, continuar',
          onOk: () => {
            setReportUuid(reportUuid);
            setReportModalOpen(true);
          },
        });
      }
    } catch (error: unknown) {
      console.error(error);
      const err = error as { response?: { data?: { error?: string; message?: string } } };
      message.error(err.response?.data?.error || err.response?.data?.message || 'Error al procesar la solicitud');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <LoadingOutlined style={{ fontSize: 24 }} spin />
        <div style={{ marginTop: 16, color: '#888' }}>Cargando...</div>
      </div>
    );
  }

  // Preinscripcion mode: missing period
  if (isPreinscription && preinscriptionMissing) {
    return (
      <Alert
        type="warning"
        message="No hay período de preinscripción activo"
        description={
          <div>
            <p style={{ marginBottom: 16 }}>
              No existe un período escolar con estado <strong>Preinscripción</strong> (el año escolar siguiente al activo).
              Para inscribir estudiantes en el próximo período, primero debe crearlo.
            </p>
            <Button
              type="primary"
              loading={creatingPreinscription}
              onClick={handleCreatePreinscription}
            >
              Crear período de preinscripción
            </Button>
          </div>
        }
        showIcon
      />
    );
  }

  // Inscripcion mode: missing active period
  if (!isPreinscription && !selectedPeriodId) {
    return (
      <Alert
        type="warning"
        message="No hay periodo escolar activo"
        description="Para inscribir estudiantes, primero debe configurar un periodo escolar activo desde el módulo de Gestión Académica."
        showIcon
      />
    );
  }

  return (
    <>
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
        {/* Selector de período: solo visible en modo inscripcion */}
        {!isPreinscription && (
          <div style={{ marginBottom: 24, padding: 20, background: '#eaf3ff', border: '2px solid #91caff', borderRadius: 10, boxShadow: '0 2px 8px rgba(24, 144, 255, 0.12)' }}>
            <Form.Item label={<span style={{ fontSize: 16, fontWeight: 700, color: '#0958d9' }}>Período Escolar</span>} style={{ marginBottom: 0 }}>
              <Select
                size="large"
                style={{ fontSize: 17, fontWeight: 600 }}
                value={selectedPeriodId}
                onChange={(val) => handlePeriodChange(val)}
                placeholder="Seleccione período"
              >
                {allPeriods.map(p => (
                  <Option key={p.id} value={p.id}>
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 11, marginLeft: 8 }}>{p.period}</span>
                    {p.status === 'activo' && <Tag color="green" style={{ marginLeft: 8, fontSize: 10 }}>Activo</Tag>}
                    {p.status === 'preinscripcion' && <Tag color="blue" style={{ marginLeft: 8, fontSize: 10 }}>Preinscripción</Tag>}
                    {p.status === 'historico' && <Tag color="default" style={{ marginLeft: 8, fontSize: 10 }}>Cerrado</Tag>}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </div>
        )}

        {/* Banner informativo en modo preinscripcion */}
        {isPreinscription && selectedPeriodId && (
          <div style={{ marginBottom: 24, padding: 20, background: '#e6f7ff', border: '2px solid #91d5ff', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Tag color="blue" style={{ fontSize: 13, fontWeight: 600, padding: '4px 12px' }}>Preinscripción</Tag>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#0958d9' }}>
                {allPeriods.find(p => p.id === selectedPeriodId)?.name ?? 'Período de preinscripción'}
              </span>
            </div>
            <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
              Los estudiantes registrados aquí quedarán inscritos en el próximo año escolar.
            </div>
          </div>
        )}

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
              <Form.Item name="firstName" label="Nombres" rules={[
                { required: true },
                { pattern: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, message: 'No se permiten números' },
              ]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="lastName" label="Apellidos" rules={[
                { required: true },
                { pattern: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, message: 'No se permiten números' },
              ]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={studentDocumentType === 'Cedula Escolar' ? 6 : 8}>
              <Form.Item name="documentType" label="Tipo Doc" rules={[{ required: true }]}>
                <Select>
                  <Option value="Venezolano">Venezolano</Option>
                  <Option value="Extranjero">Extranjero</Option>
                  <Option value="Pasaporte">Pasaporte</Option>
                  <Option value="Cedula Escolar">Cédula Escolar</Option>
                </Select>
              </Form.Item>
            </Col>
            {studentDocumentType === 'Cedula Escolar' && (
              <Col span={6}>
                <Form.Item
                  name="nationality"
                  label="Nac."
                  rules={[{ required: true, message: 'Requerido' }]}
                  initialValue="Venezolano"
                >
                  <Select>
                    <Option value="Venezolano">Venezolano</Option>
                    <Option value="Extranjero">Extranjero</Option>
                  </Select>
                </Form.Item>
              </Col>
            )}
            <Col span={studentDocumentType === 'Cedula Escolar' ? 12 : 16}>
              <Form.Item noStyle shouldUpdate={(prev, cur) => prev.documentType !== cur.documentType || prev.nationality !== cur.nationality}>
                {({ getFieldValue }) => {
                  const docType = getFieldValue('documentType') as string;
                  const nat = getFieldValue('nationality') as string;
                  const prefix = (docType === 'Venezolano' || (docType === 'Cedula Escolar' && nat === 'Venezolano')) ? 'V-'
                    : (docType === 'Extranjero' || (docType === 'Cedula Escolar' && nat === 'Extranjero')) ? 'E-'
                    : undefined;
                  return (
                    <Form.Item
                      name="document"
                      label="Documento"
                      rules={[
                        { required: true },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value) return Promise.resolve();
                            const dt = getFieldValue('documentType');
                            if (dt === 'Cedula Escolar') return Promise.resolve();
                            if ((dt === 'Venezolano' || dt === 'Extranjero') && !/^\d{5,8}$/.test(value)) {
                              return Promise.reject('Formato: solo dígitos (5-8)');
                            }
                            return Promise.resolve();
                          },
                        }),
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value) return Promise.resolve();
                            const motherDoc = getFieldValue(['mother', 'document']);
                            const fatherDoc = getFieldValue(['father', 'document']);
                            const repDoc = getFieldValue(['representative', 'document']);
                            if (motherDoc && value === motherDoc) return Promise.reject('La cédula no puede ser igual a la de la madre');
                            if (fatherDoc && value === fatherDoc) return Promise.reject('La cédula no puede ser igual a la del padre');
                            if (repDoc && value === repDoc) return Promise.reject('La cédula no puede ser igual a la del representante');
                            return Promise.resolve();
                          },
                        }),
                      ]}
                    >
                      <Input
                        placeholder={docType === 'Cedula Escolar' ? 'Vacío para autogenerar' : ''}
                        addonBefore={prefix}
                        onChange={(e) => {
                          if (docType === 'Venezolano' || docType === 'Extranjero' || docType === 'Cedula Escolar') {
                            let val = e.target.value.replace(/^[VE]-/, '').replace(/[^0-9]/g, '');
                            newStudentForm.setFieldValue('document', val);
                          }
                        }}
                      />
                    </Form.Item>
                  );
                }}
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
              <Form.Item name="birthdate" label="Fecha Nacimiento" rules={[
                { required: true },
                () => ({
                  validator(_, value) {
                    if (!value) return Promise.resolve();
                    if (value.isAfter(dayjs(), 'day')) {
                      return Promise.reject('La fecha no puede ser futura');
                    }
                    return Promise.resolve();
                  },
                }),
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value) return Promise.resolve();
                    const motherBirthdate = getFieldValue(['mother', 'birthdate']);
                    const fatherBirthdate = getFieldValue(['father', 'birthdate']);
                    if (motherBirthdate && value.isBefore(motherBirthdate)) {
                      return Promise.reject('El estudiante no puede ser mayor que la madre');
                    }
                    if (fatherBirthdate && value.isBefore(fatherBirthdate)) {
                      return Promise.reject('El estudiante no puede ser mayor que el padre');
                    }
                    return Promise.resolve();
                  },
                }),
              ]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" defaultPickerValue={dayjs().subtract(10, 'year')} />
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(prev, cur) => prev.birthdate !== cur.birthdate}>
                {({ getFieldValue }) => {
                  const bdate = getFieldValue('birthdate');
                  if (!bdate) return null;
                  const years = dayjs().diff(bdate, 'year');
                  const months = dayjs().diff(bdate, 'month') % 12;
                  const label = years > 0
                    ? `${years} año${years !== 1 ? 's' : ''}${months > 0 ? ` y ${months} mes${months !== 1 ? 'es' : ''}` : ''}`
                    : `${months} mes${months !== 1 ? 'es' : ''}`;
                  return (
                    <div style={{ marginTop: -8, marginBottom: 8 }}>
                      <Tag color="blue" style={{ fontSize: 13, fontWeight: 600, borderRadius: 8 }}>
                        {label}
                      </Tag>
                    </div>
                  );
                }}
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
                <Select
                  showSearch
                  placeholder="Seleccione una patología"
                  optionFilterProp="label"
                  options={[
                    { value: 'ninguna', label: 'Ninguna' },
                    { value: 'asma', label: 'Asma' },
                    { value: 'alergias', label: 'Alergias (alimentarias, estacionales)' },
                    { value: 'dermatitis', label: 'Dermatitis / Problemas de piel' },
                    { value: 'miopia', label: 'Miopía / Problemas de visión' },
                    { value: 'hipoacusia', label: 'Hipoacusia / Problemas de audición' },
                    { value: 'tdah', label: 'TDAH (Déficit de atención)' },
                    { value: 'dislexia', label: 'Dislexia / Dificultades de aprendizaje' },
                    { value: 'autismo', label: 'Trastorno del Espectro Autista (TEA)' },
                    { value: 'ansiedad', label: 'Ansiedad / Trastornos emocionales' },
                    { value: 'epilepsia', label: 'Epilepsia / Convulsiones' },
                    { value: 'diabetes', label: 'Diabetes (Tipo 1 o 2)' },
                    { value: 'obesidad', label: 'Obesidad / Sobrepeso' },
                    { value: 'anemia', label: 'Anemia' },
                    { value: 'celiaquia', label: 'Enfermedad Celíaca' },
                    { value: 'lactosa', label: 'Intolerancia a la lactosa' },
                    { value: 'escoliosis', label: 'Escoliosis / Problemas posturales' },
                    { value: 'cardiopatia', label: 'Cardiopatía congénita' },
                    { value: 'renales', label: 'Problemas renales / urinarios' },
                    { value: 'migrana', label: 'Migraña / Cefaleas frecuentes' },
                    { value: 'tiroides', label: 'Problemas de tiroides' },
                    { value: 'lenguaje', label: 'Trastorno del lenguaje / habla' },
                    { value: 'motriz', label: 'Discapacidad motriz' },
                    { value: 'otra', label: 'Otra (especificar)' },
                  ]}
                />
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(prev, cur) => prev.pathology !== cur.pathology}>
                {({ getFieldValue }) => {
                  const path = getFieldValue('pathology');
                  return path === 'otra' ? (
                    <Form.Item name="customPathology" label="Especifique la patología">
                      <Input placeholder="Describa la patología" />
                    </Form.Item>
                  ) : null;
                }}
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="livingWith" label="¿Con quién vive?">
                <Select
                  showSearch
                  placeholder="Seleccione una opción"
                  optionFilterProp="label"
                  onChange={(val: string) => {
                    if (val !== 'otro') {
                      newStudentForm.setFieldsValue({ customLivingWith: undefined });
                    }
                  }}
                  options={[
                    { value: 'ambos_padres', label: 'Con ambos padres' },
                    { value: 'madre', label: 'Con la madre' },
                    { value: 'padre', label: 'Con el padre' },
                    { value: 'abuelos', label: 'Con los abuelos' },
                    { value: 'familiar', label: 'Con un familiar (tíos, hermanos)' },
                    { value: 'tutor_legal', label: 'Con un tutor legal' },
                    { value: 'madre_padrastro', label: 'Con la madre y padrastro' },
                    { value: 'padre_madrastra', label: 'Con el padre y madrastra' },
                    { value: 'custodia_compartida', label: 'Custodia compartida (ambos hogares)' },
                    { value: 'residencia_estudiantil', label: 'En residencia estudiantil / internado' },
                    { value: 'independiente', label: 'Vive de forma independiente' },
                    { value: 'otro', label: 'Otro (especificar)' },
                  ]}
                />
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(prev, cur) => prev.livingWith !== cur.livingWith}>
                {({ getFieldValue }) => {
                  const val = getFieldValue('livingWith');
                  return val === 'otro' ? (
                    <Form.Item name="customLivingWith" label="Especifique con quién vive">
                      <Input placeholder="Describa la situación de convivencia" />
                    </Form.Item>
                  ) : null;
                }}
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
              <Radio.Button value="sibling">Hermano/a</Radio.Button>
              <Radio.Button value="grandparent">Abuelo/a</Radio.Button>
              <Radio.Button value="uncle_aunt">Tío/a</Radio.Button>
              <Radio.Button value="other">Otra persona</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {/* MADRE */}
          <div style={{ background: '#fafafa', padding: 16, borderRadius: 8, marginBottom: 24, border: '1px solid #f0f0f0' }}>
            <h4 style={{ color: '#fa8c16', marginBottom: 16 }}>
              Datos de la Madre {motherFieldsRequired ? '(Obligatorio)' : '(Opcional)'}
            </h4>
            {renderGuardianDocumentControls('mother', motherFieldsRequired)}

            {motherIsRepresentative && (
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={12}>
                  <Form.Item
                    name={['mother', 'birthdate']}
                    label="Fecha de Nacimiento"
                    rules={[{ required: true, message: 'Ingrese la fecha de nacimiento' }]}
                  >
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
              </Row>
            )}

            {showMotherDetails && (
              <>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name={['mother', 'firstName']} label="Nombres" rules={motherFieldsRequired ? [{ required: true }, { pattern: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, message: 'No se permiten números' }] : [{ pattern: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, message: 'No se permiten números' }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['mother', 'lastName']} label="Apellidos" rules={motherFieldsRequired ? [{ required: true }, { pattern: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, message: 'No se permiten números' }] : [{ pattern: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, message: 'No se permiten números' }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name={['mother', 'whatsapp']} label="WhatsApp / Teléfono" rules={motherFieldsRequired ? [{ required: true }, { pattern: /^(04|02)\d{2}-\d{7}$/, message: 'Formato: 04XX-XXXXXXX o 02XX-XXXXXXX' }] : [{ pattern: /^(04|02)\d{2}-\d{7}$/, message: 'Formato: 04XX-XXXXXXX o 02XX-XXXXXXX' }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['mother', 'phone2']} label="Teléfono secundario" rules={[{ pattern: /^(04|02)\d{2}-\d{7}$/, message: 'Formato: 04XX-XXXXXXX o 02XX-XXXXXXX' }]}>
                      <Input placeholder="Opcional" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
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

            {fatherIsRepresentative && (
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={12}>
                  <Form.Item
                    name={['father', 'birthdate']}
                    label="Fecha de Nacimiento"
                    rules={[{ required: true, message: 'Ingrese la fecha de nacimiento' }]}
                  >
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
              </Row>
            )}

            {showFatherDetails && (
              <>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name={['father', 'firstName']} label="Nombres" rules={fatherFieldsRequired ? [{ required: true }, { pattern: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, message: 'No se permiten números' }] : [{ pattern: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, message: 'No se permiten números' }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['father', 'lastName']} label="Apellidos" rules={fatherFieldsRequired ? [{ required: true }, { pattern: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, message: 'No se permiten números' }] : [{ pattern: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, message: 'No se permiten números' }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name={['father', 'whatsapp']} label="WhatsApp / Teléfono" rules={fatherFieldsRequired ? [{ required: true }, { pattern: /^(04|02)\d{2}-\d{7}$/, message: 'Formato: 04XX-XXXXXXX o 02XX-XXXXXXX' }] : [{ pattern: /^(04|02)\d{2}-\d{7}$/, message: 'Formato: 04XX-XXXXXXX o 02XX-XXXXXXX' }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['father', 'phone2']} label="Teléfono secundario" rules={[{ pattern: /^(04|02)\d{2}-\d{7}$/, message: 'Formato: 04XX-XXXXXXX o 02XX-XXXXXXX' }]}>
                      <Input placeholder="Opcional" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name={['father', 'email']} label="Email" rules={[{ type: 'email' }]}>
                      <Input placeholder="Opcional" />
                    </Form.Item>
                  </Col>
                </Row>

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

              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={12}>
                  <Form.Item
                    name={['representative', 'birthdate']}
                    label="Fecha de Nacimiento"
                    rules={representativeFieldsRequired ? [{ required: true, message: 'Ingrese la fecha de nacimiento' }] : []}
                  >
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
              </Row>

              {showRepresentativeDetails && (
                <>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name={['representative', 'firstName']} label="Nombres" rules={representativeFieldsRequired ? [{ required: true }, { pattern: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, message: 'No se permiten números' }] : [{ pattern: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, message: 'No se permiten números' }]}>
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name={['representative', 'lastName']} label="Apellidos" rules={representativeFieldsRequired ? [{ required: true }, { pattern: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, message: 'No se permiten números' }] : [{ pattern: /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/, message: 'No se permiten números' }]}>
                        <Input />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name={['representative', 'whatsapp']} label="WhatsApp / Teléfono" rules={representativeFieldsRequired ? [{ required: true }, { pattern: /^(04|02)\d{2}-\d{7}$/, message: 'Formato: 04XX-XXXXXXX o 02XX-XXXXXXX' }] : [{ pattern: /^(04|02)\d{2}-\d{7}$/, message: 'Formato: 04XX-XXXXXXX o 02XX-XXXXXXX' }]}>
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name={['representative', 'phone2']} label="Teléfono secundario" rules={[{ pattern: /^(04|02)\d{2}-\d{7}$/, message: 'Formato: 04XX-XXXXXXX o 02XX-XXXXXXX' }]}>
                        <Input placeholder="Opcional" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
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
          <div style={{ marginBottom: 24, textAlign: 'center', padding: 24 }}>
            <LoadingOutlined style={{ fontSize: 18 }} spin />
            <div style={{ marginTop: 8, color: '#888' }}>Cargando preguntas...</div>
          </div>
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
            {isPreinscription ? 'Preinscribir Estudiante' : 'Inscribir Estudiante'}
          </Button>
          <div style={{ marginTop: 8, color: '#888', fontSize: 12, textAlign: 'center' }}>
            * Los estudiantes no requieren usuario y contraseña
          </div>
        </Form.Item>
      </Form>

      <Modal open={previewOpen} title={previewTitle} footer={null} onCancel={handleCancelPreview}>
        <img alt="example" style={{ width: '100%' }} src={previewImage} />
      </Modal>

      <EnrollmentReportModal
        open={reportModalOpen}
        uuid={reportUuid}
        onClose={() => { setReportModalOpen(false); setReportUuid(null); }}
      />
    </>
  );
};

export default NewStudentEnrollmentForm;
