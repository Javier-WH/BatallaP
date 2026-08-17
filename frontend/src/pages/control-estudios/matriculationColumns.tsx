import type { ColDef, ColGroupDef } from 'ag-grid-community';
import type { EnrollmentQuestionResponse } from '@/services/enrollmentQuestions';
import dayjs from 'dayjs';

// Re-export types needed by the parent
export type EscolaridadStatus = 'regular' | 'repitiente' | 'materia_pendiente';
export type RepresentativeType = 'mother' | 'father' | 'other';

export interface GuardianProfile {
  id?: number;
  document?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  documentType?: string;
  residenceState?: string;
  residenceMunicipality?: string;
  residenceParish?: string;
  address?: string;
  email?: string;
  occupation?: string;
}

// Venezuela location catalog (GET /locations/venezuela)
export interface VenezuelaMunicipality {
  municipio: string;
  parroquias: string[];
}

export interface VenezuelaState {
  estado: string;
  municipios: VenezuelaMunicipality[];
}

export interface TempData {
  id: number;
  firstName: string;
  lastName: string;
  documentType: string;
  document: string;
  gender?: string;
  gradeId: number;
  sectionId?: number | null;
  subjectIds: number[];
  escolaridad: EscolaridadStatus;
  phone1?: string;
  whatsapp?: string;
  birthdate: dayjs.Dayjs | null;
  mother?: GuardianProfile;
  father?: GuardianProfile;
  representative?: GuardianProfile;
  representativeType: RepresentativeType;
  enrollmentAnswers: Record<number, string | string[] | undefined>;
  address: string;
  birthState: string;
  birthMunicipality: string;
  birthParish: string;
  residenceState: string;
  residenceMunicipality: string;
  residenceParish: string;
  pathology?: string;
  livingWith?: string;
  [key: string]: unknown;
}

export interface EnrollmentDocumentInfo {
  receivedCertificadoAprendizaje?: boolean;
  receivedCartaBuenaConducta?: boolean;
  receivedNotasCertificadas?: boolean;
  receivedPartidaNacimiento?: boolean;
  receivedCopiaCedulaEstudiante?: boolean;
  receivedInformesMedicos?: boolean;
  receivedFotoCarnetEstudiante?: boolean;
}

export interface MatriculationRow {
  id: number;
  gradeId: number;
  schoolPeriodId: number;
  sectionId?: number | null;
  status: 'pending' | 'completed';
  inscriptionId?: number | null;
  student: {
    id: number;
    firstName: string;
    lastName: string;
    document: string;
    documentType: string;
    gender?: string;
    guardians: { relationship: string; isRepresentative?: boolean; profile?: GuardianProfile }[];
    contact?: { phone1?: string; whatsapp?: string; address?: string };
    residence?: {
      birthState?: string;
      birthMunicipality?: string;
      birthParish?: string;
      residenceState?: string;
      residenceMunicipality?: string;
      residenceParish?: string;
    };
    enrollmentAnswers?: { questionId: number; answer: string | string[] | null }[];
    pathology?: string;
    livingWith?: string;
    birthdate?: string | null;
  };
  tempData: TempData;
  hiddenFromControlEstudios?: boolean;
  documents?: EnrollmentDocumentInfo | null;
  matriculation?: { documents?: EnrollmentDocumentInfo | null } | null;
}

export interface EnrollStructureEntry {
  id: number;
  gradeId: number;
  order?: number | null;
  grade?: { id: number; name: string; order?: number | null };
  sections?: { id: number; name: string }[];
  subjects?: { id: number; name: string; subjectGroupId?: number | null; subjectGroup?: { name: string } }[];
}

export interface ColumnOption {
  key: string;
  label: string;
  group: 'Estudiante' | 'Representante';
}

// Column options organized in two groups
export const BASE_COLUMN_OPTIONS: ColumnOption[] = [
  // Estudiante
  { key: 'nationality', label: 'Nacionalidad', group: 'Estudiante' },
  { key: 'document', label: 'Cédula', group: 'Estudiante' },
  { key: 'firstName', label: 'Nombres', group: 'Estudiante' },
  { key: 'lastName', label: 'Apellidos', group: 'Estudiante' },
  { key: 'gender', label: 'Género', group: 'Estudiante' },
  { key: 'status', label: 'Status', group: 'Estudiante' },
  { key: 'birthdate', label: 'Fecha Nacimiento', group: 'Estudiante' },
  { key: 'pathology', label: 'Patología', group: 'Estudiante' },
  { key: 'livingWith', label: 'Vive Con', group: 'Estudiante' },
  { key: 'birthState', label: 'Estado Nacimiento', group: 'Estudiante' },
  { key: 'birthMunicipality', label: 'Municipio Nacimiento', group: 'Estudiante' },
  { key: 'birthParish', label: 'Parroquia Nacimiento', group: 'Estudiante' },
  { key: 'residenceState', label: 'Estado Residencia', group: 'Estudiante' },
  { key: 'residenceMunicipality', label: 'Municipio Residencia', group: 'Estudiante' },
  { key: 'residenceParish', label: 'Parroquia Residencia', group: 'Estudiante' },
  { key: 'address', label: 'Dirección', group: 'Estudiante' },
  { key: 'gradeId', label: 'Grado', group: 'Estudiante' },
  { key: 'sectionId', label: 'Sección', group: 'Estudiante' },
  { key: 'subjectIds', label: 'Materias de Grupo', group: 'Estudiante' },
  { key: 'participationGroup', label: 'Grupo de Participación', group: 'Estudiante' },
  { key: 'escolaridad', label: 'Escolaridad', group: 'Estudiante' },
  // Representante
  { key: 'representativeType', label: 'Asignar Representante', group: 'Representante' },
  { key: 'representativeDocumentType', label: 'Tipo Doc. Representante', group: 'Representante' },
  { key: 'representativeDocument', label: 'Cédula Representante', group: 'Representante' },
  { key: 'representativeFirstName', label: 'Nombres Representante', group: 'Representante' },
  { key: 'representativeLastName', label: 'Apellidos Representante', group: 'Representante' },
  { key: 'representativePhone', label: 'Teléfono Representante', group: 'Representante' },
  { key: 'representativeEmail', label: 'Email Representante', group: 'Representante' },
  { key: 'representativeOccupation', label: 'Ocupación Representante', group: 'Representante' },
  { key: 'representativeAddress', label: 'Dirección Representante', group: 'Representante' },
  { key: 'representativeResidenceState', label: 'Estado Representante', group: 'Representante' },
  { key: 'representativeResidenceMunicipality', label: 'Municipio Representante', group: 'Representante' },
  { key: 'representativeResidenceParish', label: 'Parroquia Representante', group: 'Representante' },
  { key: 'phone1', label: 'Teléfono Contacto', group: 'Representante' },
  { key: 'whatsapp', label: 'WhatsApp', group: 'Representante' },
  { key: 'motherDocumentType', label: 'Tipo Doc. Madre', group: 'Representante' },
  { key: 'motherDocument', label: 'Cédula Madre', group: 'Representante' },
  { key: 'motherFirstName', label: 'Nombres Madre', group: 'Representante' },
  { key: 'motherLastName', label: 'Apellidos Madre', group: 'Representante' },
  { key: 'motherPhone', label: 'Teléfono Madre', group: 'Representante' },
  { key: 'motherEmail', label: 'Email Madre', group: 'Representante' },
  { key: 'motherOccupation', label: 'Ocupación Madre', group: 'Representante' },
  { key: 'motherAddress', label: 'Dirección Madre', group: 'Representante' },
  { key: 'motherResidenceState', label: 'Estado Madre', group: 'Representante' },
  { key: 'motherResidenceMunicipality', label: 'Municipio Madre', group: 'Representante' },
  { key: 'motherResidenceParish', label: 'Parroquia Madre', group: 'Representante' },
  { key: 'fatherDocumentType', label: 'Tipo Doc. Padre', group: 'Representante' },
  { key: 'fatherDocument', label: 'Cédula Padre', group: 'Representante' },
  { key: 'fatherFirstName', label: 'Nombres Padre', group: 'Representante' },
  { key: 'fatherLastName', label: 'Apellidos Padre', group: 'Representante' },
  { key: 'fatherPhone', label: 'Teléfono Padre', group: 'Representante' },
  { key: 'fatherEmail', label: 'Email Padre', group: 'Representante' },
  { key: 'fatherOccupation', label: 'Ocupación Padre', group: 'Representante' },
  { key: 'fatherAddress', label: 'Dirección Padre', group: 'Representante' },
  { key: 'fatherResidenceState', label: 'Estado Padre', group: 'Representante' },
  { key: 'fatherResidenceMunicipality', label: 'Municipio Padre', group: 'Representante' },
  { key: 'fatherResidenceParish', label: 'Parroquia Padre', group: 'Representante' },
];

export const getQuestionColumnKey = (id: number) => `question-${id}`;

export const COLUMN_GROUPS: string[] = ['Estudiante', 'Representante'];

// Helpers for representative logic
function getRepProfile(row: MatriculationRow): GuardianProfile | undefined {
  const t = row.tempData;
  if (t.representativeType === 'mother') return t.mother;
  if (t.representativeType === 'father') return t.father;
  return t.representative;
}

function isRepEditable(row: MatriculationRow): boolean {
  return row.tempData.representativeType === 'other';
}

// Callbacks interface
export interface ColumnCallbacks {
  onUpdateField: (id: number, field: keyof TempData, value: TempData[keyof TempData]) => void;
  /** Batch variant, used by cascading selects that must clear dependent fields atomically. */
  onUpdateFields: (id: number, changes: Partial<TempData>) => void;
  onUpdateGuardianField: (
    rowId: number,
    parentKey: 'mother' | 'father' | 'representative',
    field: keyof GuardianProfile,
    value: GuardianProfile[keyof GuardianProfile]
  ) => void;
  /** Batch variant for guardian profiles. */
  onUpdateGuardianFields: (
    rowId: number,
    parentKey: 'mother' | 'father' | 'representative',
    changes: Partial<GuardianProfile>
  ) => void;
  onUpdateAnswer: (rowId: number, questionId: number, value: string | string[] | undefined) => void;
  onToggleInscription: (id: number, hidden: boolean) => void;
  onContextMenu: (rowId: number, x: number, y: number) => void;
}

interface BuildColumnDefsParams {
  structure: EnrollStructureEntry[];
  questions: EnrollmentQuestionResponse[];
  canManageVisibility: boolean;
  visibleColumnKeys: string[];
  locations: VenezuelaState[];
  callbacks: ColumnCallbacks;
}

// Text input cell editor params
const textEditorParams = (placeholder?: string) => ({
  cellEditor: 'agTextCellEditor' as const,
  cellEditorParams: { placeholder },
});

// Build a simple text column for a tempData field
function textCol(
  field: keyof TempData,
  headerName: string,
  width: number,
  callbacks: ColumnCallbacks,
  opts?: { placeholder?: string }
): ColDef<MatriculationRow> {
  return {
    field: field as any,
    headerName,
    width,
    editable: true,
    sortable: true,
    resizable: true,
    ...textEditorParams(opts?.placeholder),
    valueGetter: (p) => (p.data?.tempData[field] as string) ?? '',
    valueSetter: (p) => {
      if (p.newValue !== p.oldValue && p.data) {
        callbacks.onUpdateField(p.data.id, field, p.newValue as TempData[keyof TempData]);
        return true;
      }
      return false;
    },
  };
}

// Build a guardian text column (mother/father/representative)
function guardianTextCol(
  parentKey: 'mother' | 'father' | 'representative',
  field: keyof GuardianProfile,
  headerName: string,
  width: number,
  callbacks: ColumnCallbacks,
  opts?: { placeholder?: string; editableFn?: (row: MatriculationRow) => boolean }
): ColDef<MatriculationRow> {
  return {
    field: `${parentKey}_${String(field)}` as any,
    headerName,
    width,
    sortable: true,
    resizable: true,
    editable: (p) => {
      if (!p.data) return false;
      if (opts?.editableFn) return opts.editableFn(p.data);
      return true;
    },
    ...textEditorParams(opts?.placeholder),
    valueGetter: (p) => {
      if (!p.data) return '';
      const guardian = p.data.tempData[parentKey];
      return (guardian?.[field] as string) ?? '';
    },
    valueSetter: (p) => {
      if (p.newValue !== p.oldValue && p.data) {
        callbacks.onUpdateGuardianField(p.data.id, parentKey, field, p.newValue as GuardianProfile[keyof GuardianProfile]);
        return true;
      }
      return false;
    },
  };
}

// ---- Cascading location (estado / municipio / parroquia) columns ----

type LocationLevel = 'state' | 'municipality' | 'parish';

/** Normalize a string for comparison: lowercase, strip accents, trim. */
function norm(s: string | undefined | null): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .trim();
}

/** Given a raw value and a list of canonical names, return the canonical
 *  name that matches case/accent-insensitively, or the raw value if no
 *  match is found.  This ensures the cell displays the catalog's spelling
 *  (e.g. "Guárico") even when the DB stores "GUÁRICO" or "guarico". */
function canonicalize(raw: string | undefined, canonical: string[]): string {
  if (!raw) return '';
  const match = canonical.find(c => norm(c) === norm(raw));
  return match ?? raw;
}

/** Options available for a level, given the currently selected parents.
 *  Comparisons are case- and accent-insensitive so that legacy data stored
 *  as "guarico" still matches the catalog entry "Guárico". */
function locationValues(
  locations: VenezuelaState[],
  level: LocationLevel,
  stateName?: string,
  municipalityName?: string
): string[] {
  if (level === 'state') return locations.map(s => s.estado);
  const state = locations.find(s => norm(s.estado) === norm(stateName));
  if (!state) return [];
  if (level === 'municipality') return state.municipios.map(m => m.municipio);
  return state.municipios.find(m => norm(m.municipio) === norm(municipalityName))?.parroquias ?? [];
}

/** Return the canonical name for a given level value, resolving against
 *  the catalog so that the displayed value matches the dropdown options. */
function canonicalValue(
  locations: VenezuelaState[],
  level: LocationLevel,
  stateName: string,
  municipalityName: string,
  value: string
): string {
  if (level === 'state') return canonicalize(value, locations.map(s => s.estado));
  const state = locations.find(s => norm(s.estado) === norm(stateName));
  if (!state) return value;
  if (level === 'municipality') return canonicalize(value, state.municipios.map(m => m.municipio));
  const mun = state.municipios.find(m => norm(m.municipio) === norm(municipalityName));
  return canonicalize(value, mun?.parroquias ?? []);
}

interface LocationColOptions {
  colId: string;
  headerName: string;
  width: number;
  level: LocationLevel;
  locations: VenezuelaState[];
  /** Reads the current value of any level for a row. */
  read: (row: MatriculationRow, level: LocationLevel) => string;
  /** Mutates the row data in-place so AG-Grid sees the change immediately. */
  mutate: (row: MatriculationRow, changes: Partial<Record<LocationLevel, string>>) => void;
  /** Persists the change to the backend / React state. */
  write: (row: MatriculationRow, changes: Partial<Record<LocationLevel, string>>) => void;
  isEditable?: (row: MatriculationRow) => boolean;
}

function locationCol(opts: LocationColOptions): ColDef<MatriculationRow> {
  const { colId, headerName, width, level, locations, read, mutate, write, isEditable } = opts;
  return {
    colId,
    headerName,
    width,
    sortable: true,
    resizable: true,
    editable: (p) => (p.data ? (isEditable ? isEditable(p.data) : true) : false),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: (p: any) => {
      if (!p.data) return { values: [] };
      const row = p.data as MatriculationRow;
      const values = locationValues(locations, level, read(row, 'state'), read(row, 'municipality'));
      // The valueGetter already canonicalizes the displayed value, so the
      // current value should be in the catalog list.  Only add it as a
      // fallback if it's still not found (e.g. legacy 'N/A').
      const current = canonicalValue(locations, level, read(row, 'state'), read(row, 'municipality'), read(row, level));
      const withCurrent = current && !values.includes(current) ? [current, ...values] : values;
      return { values: ['', ...withCurrent] };
    },
    valueGetter: (p) => {
      if (!p.data) return '';
      const row = p.data as MatriculationRow;
      return canonicalValue(locations, level, read(row, 'state'), read(row, 'municipality'), read(row, level));
    },
    valueSetter: (p) => {
      if (p.newValue === p.oldValue || !p.data) return false;
      const value = (p.newValue as string) ?? '';
      // Clear dependent levels so the cascade stays consistent.
      const changes: Partial<Record<LocationLevel, string>> =
        level === 'state' ? { state: value, municipality: '', parish: '' }
        : level === 'municipality' ? { municipality: value, parish: '' }
        : { parish: value };
      // Mutate the row data in-place so that when the dependent column's
      // cellEditorParams runs (e.g. municipality after state changes), it
      // reads the updated state value.  Without this, AG-Grid's p.data still
      // holds the old value because the React state update is asynchronous.
      mutate(p.data as MatriculationRow, changes);
      // Persist to backend / React state.
      write(p.data as MatriculationRow, changes);
      return true;
    },
  };
}

/** Location columns backed by tempData fields (student birth/residence). */
function studentLocationCol(
  kind: 'birth' | 'residence',
  level: LocationLevel,
  headerName: string,
  width: number,
  callbacks: ColumnCallbacks,
  locations: VenezuelaState[]
): ColDef<MatriculationRow> {
  const prefix = kind === 'birth' ? 'birth' : 'residence';
  const fieldOf = (lvl: LocationLevel): keyof TempData =>
    (lvl === 'state' ? `${prefix}State`
      : lvl === 'municipality' ? `${prefix}Municipality`
      : `${prefix}Parish`) as keyof TempData;
  return locationCol({
    colId: String(fieldOf(level)),
    headerName,
    width,
    level,
    locations,
    read: (row, lvl) => (row.tempData[fieldOf(lvl)] as string) ?? '',
    mutate: (row, changes) => {
      (Object.keys(changes) as LocationLevel[]).forEach(lvl => {
        (row.tempData as Record<string, unknown>)[String(fieldOf(lvl))] = changes[lvl];
      });
    },
    write: (row, changes) => {
      const payload: Partial<TempData> = {};
      (Object.keys(changes) as LocationLevel[]).forEach(lvl => {
        (payload as Record<string, unknown>)[String(fieldOf(lvl))] = changes[lvl];
      });
      callbacks.onUpdateFields(row.id, payload);
    },
  });
}

const GUARDIAN_LOCATION_FIELD: Record<LocationLevel, keyof GuardianProfile> = {
  state: 'residenceState',
  municipality: 'residenceMunicipality',
  parish: 'residenceParish',
};

/** Location columns backed by a fixed guardian profile (mother/father). */
function guardianLocationCol(
  parentKey: 'mother' | 'father',
  level: LocationLevel,
  headerName: string,
  width: number,
  callbacks: ColumnCallbacks,
  locations: VenezuelaState[]
): ColDef<MatriculationRow> {
  return locationCol({
    colId: `${parentKey}_${GUARDIAN_LOCATION_FIELD[level]}`,
    headerName,
    width,
    level,
    locations,
    read: (row, lvl) => (row.tempData[parentKey]?.[GUARDIAN_LOCATION_FIELD[lvl]] as string) ?? '',
    mutate: (row, changes) => {
      const guardian = (row.tempData[parentKey] || {}) as GuardianProfile;
      (Object.keys(changes) as LocationLevel[]).forEach(lvl => {
        (guardian as Record<string, unknown>)[GUARDIAN_LOCATION_FIELD[lvl]] = changes[lvl];
      });
      row.tempData[parentKey] = guardian;
    },
    write: (row, changes) => {
      const payload: Partial<GuardianProfile> = {};
      (Object.keys(changes) as LocationLevel[]).forEach(lvl => {
        (payload as Record<string, unknown>)[GUARDIAN_LOCATION_FIELD[lvl]] = changes[lvl];
      });
      callbacks.onUpdateGuardianFields(row.id, parentKey, payload);
    },
  });
}

/** Location columns for the active representative (resolved via representativeType). */
function repLocationCol(
  level: LocationLevel,
  headerName: string,
  width: number,
  callbacks: ColumnCallbacks,
  locations: VenezuelaState[]
): ColDef<MatriculationRow> {
  return locationCol({
    colId: `representative_${GUARDIAN_LOCATION_FIELD[level]}`,
    headerName,
    width,
    level,
    locations,
    isEditable: isRepEditable,
    read: (row, lvl) => (getRepProfile(row)?.[GUARDIAN_LOCATION_FIELD[lvl]] as string) ?? '',
    mutate: (row, changes) => {
      if (!isRepEditable(row)) return;
      const repType = row.tempData.representativeType;
      const parentKey = repType === 'mother' ? 'mother' : repType === 'father' ? 'father' : 'representative';
      const guardian = (row.tempData[parentKey] || {}) as GuardianProfile;
      (Object.keys(changes) as LocationLevel[]).forEach(lvl => {
        (guardian as Record<string, unknown>)[GUARDIAN_LOCATION_FIELD[lvl]] = changes[lvl];
      });
      row.tempData[parentKey] = guardian;
    },
    write: (row, changes) => {
      if (!isRepEditable(row)) return;
      const payload: Partial<GuardianProfile> = {};
      (Object.keys(changes) as LocationLevel[]).forEach(lvl => {
        (payload as Record<string, unknown>)[GUARDIAN_LOCATION_FIELD[lvl]] = changes[lvl];
      });
      callbacks.onUpdateGuardianFields(row.id, 'representative', payload);
    },
  });
}

// Representative column that reads from the correct guardian based on representativeType
function repCol(
  field: keyof GuardianProfile,
  headerName: string,
  width: number,
  callbacks: ColumnCallbacks,
  opts?: { placeholder?: string }
): ColDef<MatriculationRow> {
  return {
    field: `representative_${String(field)}` as any,
    headerName,
    width,
    sortable: true,
    resizable: true,
    editable: (p) => {
      if (!p.data) return false;
      return isRepEditable(p.data);
    },
    ...textEditorParams(opts?.placeholder),
    valueGetter: (p) => {
      if (!p.data) return '';
      const profile = getRepProfile(p.data);
      return (profile?.[field] as string) ?? '';
    },
    valueSetter: (p) => {
      if (p.newValue !== p.oldValue && p.data) {
        // Only write to 'representative' if type is 'other'; otherwise read-only
        if (isRepEditable(p.data)) {
          callbacks.onUpdateGuardianField(p.data.id, 'representative', field, p.newValue as GuardianProfile[keyof GuardianProfile]);
          return true;
        }
      }
      return false;
    },
  };
}

export function buildColumnDefs(params: BuildColumnDefsParams): (ColDef<MatriculationRow> | ColGroupDef<MatriculationRow>)[] {
  const { structure, questions, canManageVisibility, visibleColumnKeys, callbacks, locations } = params;
  const isCol = (key: string) => visibleColumnKeys.includes(key);
  const isQ = (id: number) => visibleColumnKeys.includes(getQuestionColumnKey(id));

  const docPrefix: Record<string, string> = {
    Venezolano: 'V-',
    Extranjero: 'E-',
    Pasaporte: 'P-',
    'Cedula Escolar': 'CE-',
  };

  // ---- Status / missing data column (always visible, pinned left) ----
  // Computes missing-field info via valueGetter so AG-Grid always has a value
  // for the cell and reliably invokes the cellRenderer.
  const statusCol: ColDef<MatriculationRow> = {
    colId: '__status__',
    headerName: '',
    width: 45,
    pinned: 'left',
    sortable: false,
    resizable: false,
    editable: false,
    suppressSizeToFit: true,
    valueGetter: (p) => {
      if (!p.data) return '';
      const row = p.data as MatriculationRow;
      const missing: string[] = [];
      const t = row.tempData;

      // Student basic data
      if (!t.firstName) missing.push('Nombres del estudiante');
      if (!t.lastName) missing.push('Apellidos del estudiante');
      if (!t.document) missing.push('Cédula del estudiante');
      if (!t.gender) missing.push('Género');
      if (!t.birthdate) missing.push('Fecha de nacimiento');

      // Representative
      const repLabel =
        t.representativeType === 'mother' ? 'madre'
        : t.representativeType === 'father' ? 'padre'
        : 'representante';
      const rep = getRepProfile(row);
      if (!rep || (!rep.firstName && !rep.lastName && !rep.document)) {
        missing.push(`Sin ${repLabel} asignado`);
      } else if (!rep.phone) {
        missing.push(`Teléfono del ${repLabel}`);
      }

      // Enrollment documents
      const docs = row.documents ?? row.matriculation?.documents;
      if (!docs) {
        missing.push('Documentos de inscripción no registrados');
      } else {
        const docFields: { key: keyof EnrollmentDocumentInfo; label: string }[] = [
          { key: 'receivedPartidaNacimiento', label: 'Partida de nacimiento' },
          { key: 'receivedCopiaCedulaEstudiante', label: 'Copia de cédula del estudiante' },
          { key: 'receivedFotoCarnetEstudiante', label: 'Foto carné del estudiante' },
          { key: 'receivedCertificadoAprendizaje', label: 'Certificado de aprendizaje' },
          { key: 'receivedCartaBuenaConducta', label: 'Carta de buena conducta' },
          { key: 'receivedNotasCertificadas', label: 'Notas certificadas' },
          { key: 'receivedInformesMedicos', label: 'Informes médicos' },
        ];
        docFields.forEach(({ key, label }) => {
          if (!docs[key]) missing.push(`Documento: ${label}`);
        });
      }

      const isHidden = !!row.hiddenFromControlEstudios;
      if (missing.length === 0 && !isHidden) return '';
      return JSON.stringify({ missing, isHidden });
    },
    cellRenderer: (p: any) => {
      if (!p.value) return <></>;
      let data: { missing: string[]; isHidden: boolean };
      try {
        data = JSON.parse(p.value);
      } catch {
        return <></>;
      }
      const { missing, isHidden } = data;
      const title = missing.length > 0
        ? `Datos faltantes (${missing.length}):\n• ${missing.join('\n• ')}`
        : '';
      return (
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          {isHidden && canManageVisibility && (
            <span title="No inscrito" style={{ color: '#ff4d4f', fontSize: 14, cursor: 'help' }}>⊘</span>
          )}
          {missing.length > 0 && (
            <span title={title} style={{ color: '#ff4d4f', fontSize: 16, cursor: 'help' }}>⚠</span>
          )}
        </span>
      );
    },
    cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  };

  // ---- Estudiante columns ----
  const estudianteCols: ColDef<MatriculationRow>[] = [];

  if (isCol('nationality')) {
    estudianteCols.push({
      colId: 'nationality',
      headerName: 'N',
      width: 50,
      editable: false,
      sortable: true,
      resizable: true,
      valueGetter: (p) => {
        if (!p.data) return '';
        const dt = p.data.tempData.documentType;
        return docPrefix[dt] || (dt?.[0]?.toUpperCase() + '-') || '';
      },
    });
  }

  if (isCol('document')) {
    estudianteCols.push({
      colId: 'document',
      headerName: 'Cédula',
      width: 120,
      editable: true,
      sortable: true,
      resizable: true,
      ...textEditorParams(),
      valueGetter: (p) => p.data?.tempData.document ?? '',
      valueSetter: (p) => {
        if (p.newValue !== p.oldValue && p.data) {
          callbacks.onUpdateField(p.data.id, 'document', p.newValue);
          return true;
        }
        return false;
      },
    });
  }

  if (isCol('lastName')) {
    estudianteCols.push({
      colId: 'lastName',
      headerName: 'Apellidos',
      width: 150,
      editable: true,
      sortable: true,
      resizable: true,
      ...textEditorParams(),
      valueGetter: (p) => p.data?.tempData.lastName ?? '',
      valueSetter: (p) => {
        if (p.newValue !== p.oldValue && p.data) {
          callbacks.onUpdateField(p.data.id, 'lastName', p.newValue);
          return true;
        }
        return false;
      },
    });
  }

  if (isCol('firstName')) {
    estudianteCols.push({
      colId: 'firstName',
      headerName: 'Nombres',
      width: 150,
      editable: true,
      sortable: true,
      resizable: true,
      ...textEditorParams(),
      valueGetter: (p) => p.data?.tempData.firstName ?? '',
      valueSetter: (p) => {
        if (p.newValue !== p.oldValue && p.data) {
          callbacks.onUpdateField(p.data.id, 'firstName', p.newValue);
          return true;
        }
        return false;
      },
    });
  }

  if (isCol('gender')) {
    estudianteCols.push({
      colId: 'gender',
      headerName: 'Género',
      width: 90,
      editable: true,
      sortable: true,
      resizable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['M', 'F'] },
      valueGetter: (p) => p.data?.tempData.gender ?? '',
      valueSetter: (p) => {
        if (p.newValue !== p.oldValue && p.data) {
          callbacks.onUpdateField(p.data.id, 'gender', p.newValue);
          return true;
        }
        return false;
      },
      cellRenderer: (p: any) => {
        if (!p.value) return null;
        const color = p.value === 'M' ? '#1677ff' : '#eb2f96';
        const label = p.value === 'M' ? 'Masc' : 'Fem';
        return (
          <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 10, background: `${color}22`, color, border: `1px solid ${color}55` }}>
            {label}
          </span>
        );
      },
    });
  }

  if (canManageVisibility && isCol('status')) {
    estudianteCols.push({
      colId: 'status',
      headerName: 'Status',
      width: 120,
      editable: true,
      sortable: true,
      resizable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['inscrito', 'no_inscrito'] },
      valueGetter: (p) => {
        if (!p.data) return '';
        return p.data.hiddenFromControlEstudios ? 'no_inscrito' : 'inscrito';
      },
      valueSetter: (p) => {
        if (p.newValue !== p.oldValue && p.data) {
          callbacks.onToggleInscription(p.data.id, p.newValue === 'no_inscrito');
          return true;
        }
        return false;
      },
      cellRenderer: (p: any) => {
        if (!p.value) return null;
        const inscrito = p.value === 'inscrito';
        return (
          <span style={{ color: inscrito ? '#52c41a' : '#ff4d4f', fontSize: 12 }}>
            {inscrito ? 'Inscrito' : 'No inscrito'}
          </span>
        );
      },
    });
  }

  if (isCol('birthdate')) {
    estudianteCols.push({
      colId: 'birthdate',
      headerName: 'Fecha Nac.',
      width: 120,
      editable: true,
      sortable: true,
      resizable: true,
      ...textEditorParams('YYYY-MM-DD'),
      valueGetter: (p) => {
        if (!p.data?.tempData.birthdate) return '';
        return p.data.tempData.birthdate.format('YYYY-MM-DD');
      },
      valueSetter: (p) => {
        if (p.newValue !== p.oldValue && p.data) {
          const val = p.newValue ? dayjs(p.newValue) : null;
          callbacks.onUpdateField(p.data.id, 'birthdate', val as TempData['birthdate']);
          return true;
        }
        return false;
      },
    });
  }

  if (isCol('pathology')) estudianteCols.push(textCol('pathology', 'Patología', 150, callbacks));
  if (isCol('livingWith')) estudianteCols.push(textCol('livingWith', 'Vive Con', 150, callbacks));
  if (isCol('birthState')) estudianteCols.push(studentLocationCol('birth', 'state', 'Edo. Nac.', 120, callbacks, locations));
  if (isCol('birthMunicipality')) estudianteCols.push(studentLocationCol('birth', 'municipality', 'Mun. Nac.', 120, callbacks, locations));
  if (isCol('birthParish')) estudianteCols.push(studentLocationCol('birth', 'parish', 'Par. Nac.', 120, callbacks, locations));
  if (isCol('residenceState')) estudianteCols.push(studentLocationCol('residence', 'state', 'Edo. Res.', 120, callbacks, locations));
  if (isCol('residenceMunicipality')) estudianteCols.push(studentLocationCol('residence', 'municipality', 'Mun. Res.', 120, callbacks, locations));
  if (isCol('residenceParish')) estudianteCols.push(studentLocationCol('residence', 'parish', 'Par. Res.', 120, callbacks, locations));
  if (isCol('address')) estudianteCols.push(textCol('address', 'Dirección', 250, callbacks));

  if (isCol('gradeId')) {
    estudianteCols.push({
      colId: 'gradeId',
      headerName: 'Año',
      width: 160,
      editable: true,
      sortable: true,
      resizable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => ({
        values: structure.map(s => s.gradeId),
      }),
      valueGetter: (p) => p.data?.tempData.gradeId ?? 0,
      valueFormatter: (p) => {
        if (!p.value) return '';
        return structure.find(s => s.gradeId === p.value)?.grade?.name ?? 'N/A';
      },
      valueSetter: (p) => {
        if (p.newValue !== p.oldValue && p.data) {
          callbacks.onUpdateField(p.data.id, 'gradeId', Number(p.newValue));
          return true;
        }
        return false;
      },
      cellRenderer: (p: any) => {
        if (!p.value) return 'N/A';
        return structure.find(s => s.gradeId === p.value)?.grade?.name ?? 'N/A';
      },
    });
  }

  if (isCol('sectionId')) {
    estudianteCols.push({
      colId: 'sectionId',
      headerName: 'Sección',
      width: 120,
      editable: true,
      sortable: true,
      resizable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: (p: any) => {
        if (!p.data) return { values: [] };
        const gradeStruct = structure.find(s => s.gradeId === p.data.tempData.gradeId);
        return { values: (gradeStruct?.sections ?? []).map(s => s.id) };
      },
      valueGetter: (p) => p.data?.tempData.sectionId ?? null,
      valueFormatter: (p) => {
        if (!p.value) return 'N/A';
        if (!p.data) return 'N/A';
        const gradeStruct = structure.find(s => s.gradeId === p.data!.tempData.gradeId);
        return gradeStruct?.sections?.find(s => s.id === p.value)?.name ?? 'N/A';
      },
      valueSetter: (p) => {
        if (p.newValue !== p.oldValue && p.data) {
          callbacks.onUpdateField(p.data.id, 'sectionId', p.newValue ? Number(p.newValue) : null);
          return true;
        }
        return false;
      },
      cellRenderer: (p: any) => {
        if (!p.data) return 'N/A';
        const gradeStruct = structure.find(s => s.gradeId === p.data.tempData.gradeId);
        return gradeStruct?.sections?.find(s => s.id === p.data.tempData.sectionId)?.name ?? 'N/A';
      },
    });
  }

  if (isCol('subjectIds')) {
    estudianteCols.push({
      colId: 'subjectIds',
      headerName: 'Materias de Grupo',
      width: 200,
      editable: true,
      sortable: false,
      resizable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: (p: any) => {
        if (!p.data) return { values: [] };
        const gradeStruct = structure.find(s => s.gradeId === p.data.tempData.gradeId);
        const groupSubjects = gradeStruct?.subjects?.filter(s => s.subjectGroupId) ?? [];
        return { values: groupSubjects.map(s => s.id) };
      },
      valueGetter: (p) => {
        if (!p.data) return '';
        return p.data.tempData.subjectIds?.[0] ?? '';
      },
      valueSetter: (p) => {
        if (p.newValue !== p.oldValue && p.data) {
          const newIds = p.newValue ? [Number(p.newValue)] : [];
          callbacks.onUpdateField(p.data.id, 'subjectIds', newIds);
          return true;
        }
        return false;
      },
      cellRenderer: (p: any) => {
        if (!p.data) return '';
        const gradeStruct = structure.find(s => s.gradeId === p.data.tempData.gradeId);
        const groupSubjects = gradeStruct?.subjects?.filter(s => s.subjectGroupId) ?? [];
        const currentId = p.data.tempData.subjectIds?.[0];
        return groupSubjects.find(s => s.id === currentId)?.name ?? '';
      },
    });
  }

  if (isCol('participationGroup')) {
    estudianteCols.push({
      colId: 'participationGroup',
      headerName: 'Grupo de Participación',
      width: 140,
      editable: false,
      sortable: true,
      resizable: true,
      valueGetter: (p) => {
        if (!p.data) return '';
        const data = p.data;
        const gradeStruct = structure.find(s => s.gradeId === data.tempData.gradeId);
        const groupSubjects = gradeStruct?.subjects?.filter(s => s.subjectGroupId) ?? [];
        const currentId = data.tempData.subjectIds?.[0];
        return groupSubjects.find(s => s.id === currentId)?.subjectGroup?.name ?? '';
      },
      cellRenderer: (p: any) => {
        if (!p.value) return <span style={{ color: '#dc2626', fontSize: 12, fontWeight: 600 }}>Sin grupo</span>;
        return <span style={{ fontSize: 12 }}>{p.value}</span>;
      },
    });
  }

  if (isCol('escolaridad')) {
    estudianteCols.push({
      colId: 'escolaridad',
      headerName: 'Escolaridad',
      width: 150,
      editable: true,
      sortable: true,
      resizable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['regular', 'repitiente', 'materia_pendiente'] },
      valueGetter: (p) => p.data?.tempData.escolaridad ?? 'regular',
      valueSetter: (p) => {
        if (p.newValue !== p.oldValue && p.data) {
          callbacks.onUpdateField(p.data.id, 'escolaridad', p.newValue as EscolaridadStatus);
          return true;
        }
        return false;
      },
      cellRenderer: (p: any) => {
        const map: Record<string, { label: string; color: string }> = {
          regular: { label: 'Regular', color: '#52c41a' },
          repitiente: { label: 'Repitiente', color: '#fa8c16' },
          materia_pendiente: { label: 'Materia pendiente', color: '#1677ff' },
        };
        const info = map[p.value] ?? { label: p.value, color: '#888' };
        return (
          <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 10, background: `${info.color}22`, color: info.color, border: `1px solid ${info.color}55` }}>
            {info.label}
          </span>
        );
      },
    });
  }

  // Custom question columns
  questions.filter(q => isQ(q.id)).forEach(q => {
    const colKey = getQuestionColumnKey(q.id);
    estudianteCols.push({
      field: colKey as any,
      headerName: q.prompt,
      width: 220,
      editable: true,
      sortable: true,
      resizable: true,
      ...(q.type === 'text'
        ? textEditorParams('...')
        : {
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: { values: q.options ?? [] },
          }),
      valueGetter: (p) => {
        if (!p.data) return '';
        const val = p.data.tempData.enrollmentAnswers?.[q.id];
        return Array.isArray(val) ? val.join(', ') : (val ?? '');
      },
      valueSetter: (p) => {
        if (p.newValue !== p.oldValue && p.data) {
          callbacks.onUpdateAnswer(p.data.id, q.id, p.newValue);
          return true;
        }
        return false;
      },
    });
  });

  // ---- Representante columns ----
  const representanteCols: ColDef<MatriculationRow>[] = [];

  if (isCol('representativeType')) {
    representanteCols.push({
      field: 'representativeType' as any,
      headerName: 'Asignar',
      width: 140,
      editable: true,
      sortable: true,
      resizable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['mother', 'father', 'other'] },
      valueGetter: (p) => p.data?.tempData.representativeType ?? 'other',
      valueSetter: (p) => {
        if (p.newValue !== p.oldValue && p.data) {
          callbacks.onUpdateField(p.data.id, 'representativeType', p.newValue as RepresentativeType);
          return true;
        }
        return false;
      },
      cellRenderer: (p: any) => {
        const map: Record<string, string> = { mother: 'Madre', father: 'Padre', other: 'Otro' };
        return map[p.value] ?? p.value;
      },
    });
  }

  // Representative fields (dynamic based on representativeType)
  if (isCol('representativeDocumentType')) representanteCols.push(repCol('documentType', 'Tipo Doc. Rep.', 100, callbacks));
  if (isCol('representativeDocument')) representanteCols.push(repCol('document', 'Cédula Rep.', 130, callbacks, { placeholder: 'Doc...' }));
  if (isCol('representativeFirstName')) representanteCols.push(repCol('firstName', 'Nombres Rep.', 140, callbacks));
  if (isCol('representativeLastName')) representanteCols.push(repCol('lastName', 'Apellidos Rep.', 140, callbacks));
  if (isCol('representativePhone')) representanteCols.push(repCol('phone', 'Teléfono Rep.', 130, callbacks));
  if (isCol('representativeEmail')) representanteCols.push(repCol('email', 'Email Rep.', 150, callbacks));
  if (isCol('representativeOccupation')) representanteCols.push(repCol('occupation', 'Ocupación Rep.', 150, callbacks));
  if (isCol('representativeAddress')) representanteCols.push(repCol('address', 'Dirección Rep.', 200, callbacks));
  if (isCol('representativeResidenceState')) representanteCols.push(repLocationCol('state', 'Estado Rep.', 120, callbacks, locations));
  if (isCol('representativeResidenceMunicipality')) representanteCols.push(repLocationCol('municipality', 'Municipio Rep.', 120, callbacks, locations));
  if (isCol('representativeResidenceParish')) representanteCols.push(repLocationCol('parish', 'Parroquia Rep.', 120, callbacks, locations));

  // Contact columns
  if (isCol('phone1')) representanteCols.push(textCol('phone1', 'Teléfono', 140, callbacks));
  if (isCol('whatsapp')) representanteCols.push(textCol('whatsapp', 'WhatsApp', 140, callbacks));

  // Mother columns
  if (isCol('motherDocumentType')) representanteCols.push(guardianTextCol('mother', 'documentType', 'Tipo Doc. Madre', 100, callbacks));
  if (isCol('motherDocument')) representanteCols.push(guardianTextCol('mother', 'document', 'Cédula Madre', 130, callbacks, { placeholder: 'Doc...' }));
  if (isCol('motherFirstName')) representanteCols.push(guardianTextCol('mother', 'firstName', 'Nombres Madre', 140, callbacks));
  if (isCol('motherLastName')) representanteCols.push(guardianTextCol('mother', 'lastName', 'Apellidos Madre', 140, callbacks));
  if (isCol('motherPhone')) representanteCols.push(guardianTextCol('mother', 'phone', 'Teléfono Madre', 130, callbacks));
  if (isCol('motherEmail')) representanteCols.push(guardianTextCol('mother', 'email', 'Email Madre', 150, callbacks));
  if (isCol('motherOccupation')) representanteCols.push(guardianTextCol('mother', 'occupation', 'Ocupación Madre', 150, callbacks));
  if (isCol('motherAddress')) representanteCols.push(guardianTextCol('mother', 'address', 'Dirección Madre', 200, callbacks));
  if (isCol('motherResidenceState')) representanteCols.push(guardianLocationCol('mother', 'state', 'Estado Madre', 120, callbacks, locations));
  if (isCol('motherResidenceMunicipality')) representanteCols.push(guardianLocationCol('mother', 'municipality', 'Municipio Madre', 120, callbacks, locations));
  if (isCol('motherResidenceParish')) representanteCols.push(guardianLocationCol('mother', 'parish', 'Parroquia Madre', 120, callbacks, locations));

  // Father columns
  if (isCol('fatherDocumentType')) representanteCols.push(guardianTextCol('father', 'documentType', 'Tipo Doc. Padre', 100, callbacks));
  if (isCol('fatherDocument')) representanteCols.push(guardianTextCol('father', 'document', 'Cédula Padre', 130, callbacks, { placeholder: 'Doc...' }));
  if (isCol('fatherFirstName')) representanteCols.push(guardianTextCol('father', 'firstName', 'Nombres Padre', 140, callbacks));
  if (isCol('fatherLastName')) representanteCols.push(guardianTextCol('father', 'lastName', 'Apellidos Padre', 140, callbacks));
  if (isCol('fatherPhone')) representanteCols.push(guardianTextCol('father', 'phone', 'Teléfono Padre', 130, callbacks));
  if (isCol('fatherEmail')) representanteCols.push(guardianTextCol('father', 'email', 'Email Padre', 150, callbacks));
  if (isCol('fatherOccupation')) representanteCols.push(guardianTextCol('father', 'occupation', 'Ocupación Padre', 150, callbacks));
  if (isCol('fatherAddress')) representanteCols.push(guardianTextCol('father', 'address', 'Dirección Padre', 200, callbacks));
  if (isCol('fatherResidenceState')) representanteCols.push(guardianLocationCol('father', 'state', 'Estado Padre', 120, callbacks, locations));
  if (isCol('fatherResidenceMunicipality')) representanteCols.push(guardianLocationCol('father', 'municipality', 'Municipio Padre', 120, callbacks, locations));
  if (isCol('fatherResidenceParish')) representanteCols.push(guardianLocationCol('father', 'parish', 'Parroquia Padre', 120, callbacks, locations));

  // Build grouped column defs
  const colDefs: (ColDef<MatriculationRow> | ColGroupDef<MatriculationRow>)[] = [
    statusCol,
    {
      headerName: 'Estudiante',
      headerClass: 'ag-group-header-estudiante',
      children: estudianteCols,
    },
    {
      headerName: 'Representante',
      headerClass: 'ag-group-header-representante',
      children: representanteCols,
    },
  ];

  return colDefs;
}

