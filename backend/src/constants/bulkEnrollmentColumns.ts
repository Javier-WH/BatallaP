export type BulkEnrollmentColumn = {
  key: string;
  header: string;
  required?: boolean;
  description?: string;
};

const guardianPrefixes = ['representative'] as const;

const guardianFields: Array<{ field: string; label: string; description?: string }> = [
  { field: 'documentType', label: 'Tipo de documento' },
  { field: 'document', label: 'Documento' },
  { field: 'firstName', label: 'Nombres' },
  { field: 'lastName', label: 'Apellidos' },
  { field: 'phone', label: 'Teléfono' },
  { field: 'email', label: 'Correo' },
  { field: 'occupation', label: 'Ocupación' },
  { field: 'address', label: 'Dirección' },
  { field: 'residenceState', label: 'Estado de residencia' },
  { field: 'residenceMunicipality', label: 'Municipio de residencia' },
  { field: 'residenceParish', label: 'Parroquia de residencia' }
];

export const BULK_ENROLLMENT_COLUMNS: BulkEnrollmentColumn[] = [
  // Datos del estudiante - Identificación primero
  { key: 'firstName', header: '* Nombres estudiante', required: true },
  { key: 'lastName', header: '* Apellidos estudiante', required: true },
  { key: 'documentType', header: '* Tipo de documento estudiante', required: true },
  { key: 'document', header: 'Documento estudiante' },

  // Datos personales obligatorios
  { key: 'gender', header: '* Género (M/F)', required: true },
  { key: 'birthdate', header: '* Fecha de nacimiento (YYYY-MM-DD o DD/MM/YYYY)', required: true },

  // Lugar de nacimiento (obligatorio)
  { key: 'birthState', header: '* Estado de nacimiento', required: true },
  { key: 'birthMunicipality', header: '* Municipio de nacimiento', required: true },
  { key: 'birthParish', header: '* Parroquia de nacimiento', required: true },

  // Residencia (obligatorio)
  { key: 'residenceState', header: '* Estado de residencia', required: true },
  { key: 'residenceMunicipality', header: '* Municipio de residencia', required: true },
  { key: 'residenceParish', header: '* Parroquia de residencia', required: true },
  { key: 'address', header: 'Dirección de habitación' },

  // Contacto del estudiante
  { key: 'email', header: 'Correo del estudiante' },

  // Información adicional
  { key: 'pathology', header: 'Patología' },
  { key: 'livingWith', header: '¿Con quién vive?' },
  { key: 'previousSchoolIds', header: 'Planteles de procedencia (separados por ;)' },

  // Datos de inscripción
  { key: 'schoolPeriod', header: '* Periodo escolar (nombre)', required: true },
  { key: 'grade', header: '* Grado (nombre)', required: true },
  { key: 'section', header: 'Sección (nombre)' },
  { key: 'escolaridad', header: '* Escolaridad (regular/repitiente/materia_pendiente)', required: true },
  { key: 'representativeType', header: '* Quién representa (mother/father/sibling/grandparent/uncle_aunt/other)', required: true, description: 'Valores permitidos: mother, father, sibling, grandparent, uncle_aunt, other' }
];

guardianPrefixes.forEach((prefix) => {
  guardianFields.forEach((field) => {
    BULK_ENROLLMENT_COLUMNS.push({
      key: `${prefix}.${field.field}`,
      header: `Representante - ${field.label}`,
      description: field.description
    });
  });
});

export type BulkEnrollmentRow = Record<string, string | number | null | undefined>;
