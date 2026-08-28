import { Request, Response } from 'express';
import { ConstanciaTemplate, Person, Inscription, SchoolPeriod, Grade, Section, Subject, SubjectFinalGrade, InscriptionSubject, Setting } from '@/models';
import sequelize from '@/config/database';
import { Op } from 'sequelize';

// ── Role helpers ──
const ALLOWED_ROLES = ['Master', 'Administrador', 'Control de Estudios'];

function hasRole(req: Request, roles: string[]): boolean {
  const user = (req.session as any)?.user;
  if (!user?.roles) return false;
  return user.roles.some((r: string) => roles.includes(r));
}

// ── Variable resolution ──
// Variables use the {{category.field}} format, e.g. {{student.firstName}}
// Returns an object with all resolved variables for a given student + period
// Convert grade order (1-5) to ordinal string: 1→1er, 2→2do, 3→3er, 4→4to, 5→5to
function gradeToOrdinal(order?: number | null): string {
  if (order == null) return '';
  const suffixes: Record<number, string> = { 1: 'er', 2: 'do', 3: 'er', 4: 'to', 5: 'to', 6: 'to' };
  const suffix = suffixes[order] || 'to';
  return `${order}${suffix}`;
}

// Convert day number to ordinal: 1→1ero, 2→2do, 15→15, etc.
function toOrdinal(day: number): string {
  if (day === 1) return '1ero';
  if (day === 2) return '2do';
  if (day === 3) return '3ero';
  return String(day);
}

async function resolveVariables(personId: number, schoolPeriodId: number): Promise<Record<string, string>> {
  const person = await Person.findByPk(personId);
  if (!person) throw new Error('Estudiante no encontrado');

  // Institution settings
  const settings = await Setting.findAll();
  const settingsMap: Record<string, string> = {};
  settings.forEach(s => { settingsMap[s.key] = s.value; });

  // Find inscription for this period
  const inscription = await Inscription.findOne({
    where: { personId, schoolPeriodId },
    include: [
      { model: Grade, as: 'grade' },
      { model: Section, as: 'section' },
    ],
  }) as any;

  const period = await SchoolPeriod.findByPk(schoolPeriodId);

  // Get subject final grades
  let subjectsData: { name: string; finalScore: number | null }[] = [];
  if (inscription) {
    const inscriptionSubjects = await InscriptionSubject.findAll({
      where: { inscriptionId: inscription.id },
      include: [
        { model: Subject, as: 'subject' },
      ],
    });
    const subjectIds = inscriptionSubjects.map(is => is.id);
    if (subjectIds.length > 0) {
      const finalGrades = await SubjectFinalGrade.findAll({
        where: { inscriptionSubjectId: { [Op.in]: subjectIds } },
      });
      const gradeMap = new Map<number, number | null>();
      finalGrades.forEach(fg => gradeMap.set(fg.inscriptionSubjectId, fg.finalScore));
      subjectsData = inscriptionSubjects.map(is => ({
        name: is.subject?.name || '',
        finalScore: gradeMap.get(is.id) ?? null,
      }));
    }
  }

  // Student data
  const firstName = person.firstName || '';
  const lastName = person.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const documentType = person.documentType || '';
  const document = person.document || '';
  const fullDocument = `${documentType} ${document}`.trim();
  const birthdate = person.birthdate ? new Date(person.birthdate) : null;
  const gender = person.gender || '';

  // Format date in Spanish
  const formatDate = (d: Date): string => {
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
  };

  // Calculate age
  const age = birthdate
    ? Math.floor((Date.now() - birthdate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const vars: Record<string, string> = {
    // Student
    'student.firstName': firstName,
    'student.lastName': lastName,
    'student.fullName': fullName,
    'student.documentType': documentType,
    'student.document': document,
    'student.fullDocument': fullDocument,
    'student.birthdate': birthdate ? birthdate.toISOString().split('T')[0] : '',
    'student.birthdateLong': birthdate ? formatDate(birthdate) : '',
    'student.age': age !== null ? String(age) : '',
    'student.gender': gender,
    // Determined articles based on gender (el/la)
    'student.article': gender === 'F' ? 'la' : 'el',
    'student.articleUpper': gender === 'F' ? 'La' : 'El',
    // Institution
    'institution.name': settingsMap['institution_name'] || '',
    'institution.code': settingsMap['institution_code'] || '',
    'institution.address': settingsMap['institution_address'] || '',
    'institution.phone': settingsMap['institution_phone'] || '',
    'institution.municipality': settingsMap['institution_municipality'] || '',
    'institution.state': settingsMap['institution_state'] || '',
    'institution.director': settingsMap['director_name'] || '',
    'institution.directorDocument': settingsMap['director_document'] || '',
    // Academic
    'grade.name': inscription?.grade?.name || '',
    'grade.nameUpper': (inscription?.grade?.name || '').toUpperCase(),
    'grade.ordinal': gradeToOrdinal(inscription?.grade?.order),
    'section.name': inscription?.section?.name || '',
    'section.nameUpper': (inscription?.section?.name || '').toUpperCase(),
    'period.name': period?.name || '',
    // Certificate
    'date': new Date().toISOString().split('T')[0],
    'date.long': formatDate(new Date()),
    'date.day': String(new Date().getDate()),
    'date.dayOrdinal': toOrdinal(new Date().getDate()),
    'date.month': new Date().toLocaleString('es-ES', { month: 'long' }),
    'date.monthUpper': new Date().toLocaleString('es-ES', { month: 'long' }).toUpperCase(),
    'date.year': String(new Date().getFullYear()),
  };

  // Add subject grades as variables: subject.<name> = score
  subjectsData.forEach(s => {
    const key = `subject.${s.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    vars[key] = s.finalScore !== null ? String(s.finalScore) : '';
  });

  return vars;
}

// Replace {{variables}} in HTML content
function renderTemplate(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{([^}]+)\}\}/g, (match, varName: string) => {
    const key = varName.trim();
    return vars[key] !== undefined ? vars[key] : match;
  });
}

// Extract all {{variables}} from HTML content
function extractVariables(html: string): string[] {
  const matches = html.matchAll(/\{\{([^}]+)\}\}/g);
  const vars: string[] = [];
  for (const m of matches) {
    const v = m[1].trim();
    if (!vars.includes(v)) vars.push(v);
  }
  return vars;
}

// Analyze a template's variables and classify them
export const analyzeTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = await ConstanciaTemplate.findByPk(Number(id));
    if (!template) return res.status(404).json({ message: 'Plantilla no encontrada' });

    const allVars = extractVariables(template.content);
    const needsStudent = allVars.some(v => v.startsWith('student.'));
    const customVars = allVars
      .filter(v => v.startsWith('custom.'))
      .map(v => v.replace('custom.', ''));

    return res.json({
      allVariables: allVars,
      needsStudent,
      customVars,
    });
  } catch (error) {
    console.error('[analyzeTemplate] Error:', error);
    return res.status(500).json({ message: 'Error al analizar plantilla' });
  }
};

// ── CRUD ──

export const listTemplates = async (req: Request, res: Response) => {
  try {
    const templates = await ConstanciaTemplate.findAll({
      order: [['name', 'ASC']],
      attributes: ['id', 'name', 'createdAt', 'updatedAt'],
    });
    return res.json(templates);
  } catch (error) {
    console.error('[listTemplates] Error:', error);
    return res.status(500).json({ message: 'Error al listar plantillas' });
  }
};

export const getTemplate = async (req: Request, res: Response) => {
  try {
    const template = await ConstanciaTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ message: 'Plantilla no encontrada' });
    return res.json(template);
  } catch (error) {
    console.error('[getTemplate] Error:', error);
    return res.status(500).json({ message: 'Error al obtener plantilla' });
  }
};

export const createTemplate = async (req: Request, res: Response) => {
  if (!hasRole(req, ALLOWED_ROLES)) {
    return res.status(403).json({ message: 'No tiene permisos para esta acción' });
  }
  try {
    const { name, content } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'El nombre es requerido' });
    }
    const template = await ConstanciaTemplate.create({
      name: name.trim(),
      content: content || '',
    } as any);
    return res.status(201).json(template);
  } catch (error) {
    console.error('[createTemplate] Error:', error);
    return res.status(500).json({ message: 'Error al crear plantilla' });
  }
};

export const updateTemplate = async (req: Request, res: Response) => {
  if (!hasRole(req, ALLOWED_ROLES)) {
    return res.status(403).json({ message: 'No tiene permisos para esta acción' });
  }
  try {
    const template = await ConstanciaTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ message: 'Plantilla no encontrada' });
    const { name, content } = req.body;
    if (name !== undefined) template.name = name.trim();
    if (content !== undefined) template.content = content;
    await template.save();
    return res.json(template);
  } catch (error) {
    console.error('[updateTemplate] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar plantilla' });
  }
};

export const deleteTemplate = async (req: Request, res: Response) => {
  if (!hasRole(req, ALLOWED_ROLES)) {
    return res.status(403).json({ message: 'No tiene permisos para esta acción' });
  }
  try {
    const template = await ConstanciaTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).json({ message: 'Plantilla no encontrada' });
    await template.destroy();
    return res.json({ message: 'Plantilla eliminada' });
  } catch (error) {
    console.error('[deleteTemplate] Error:', error);
    return res.status(500).json({ message: 'Error al eliminar plantilla' });
  }
};

// ── Generate ──

// Returns rendered HTML for preview.
// Body: { templateId, personId?, schoolPeriodId?, customVars?: Record<string, string> }
// personId is optional — some constancias (e.g. work certificates) may not need a student.
export const generatePreview = async (req: Request, res: Response) => {
  try {
    const { templateId, personId, schoolPeriodId, customVars } = req.body;
    if (!templateId) {
      return res.status(400).json({ message: 'templateId es requerido' });
    }
    const template = await ConstanciaTemplate.findByPk(Number(templateId));
    if (!template) return res.status(404).json({ message: 'Plantilla no encontrada' });

    // Resolve system variables if personId is provided
    let vars: Record<string, string> = {};
    if (personId) {
      const periodId = schoolPeriodId || null;
      vars = await resolveVariables(Number(personId), periodId);
    }

    // Merge custom variables (user-provided text inputs)
    if (customVars && typeof customVars === 'object') {
      for (const [key, value] of Object.entries(customVars)) {
        vars[`custom.${key}`] = String(value);
      }
    }

    const html = renderTemplate(template.content, vars);
    return res.json({ html, variables: vars });
  } catch (error: any) {
    console.error('[generatePreview] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al generar vista previa' });
  }
};

// Returns available variables metadata for the editor
export const getVariables = async (_req: Request, res: Response) => {
  const variables = [
    // Student
    { group: 'Estudiante', key: 'student.firstName', label: 'Nombre' },
    { group: 'Estudiante', key: 'student.lastName', label: 'Apellido' },
    { group: 'Estudiante', key: 'student.fullName', label: 'Nombre completo' },
    { group: 'Estudiante', key: 'student.documentType', label: 'Tipo de documento' },
    { group: 'Estudiante', key: 'student.document', label: 'Cédula' },
    { group: 'Estudiante', key: 'student.fullDocument', label: 'Documento completo' },
    { group: 'Estudiante', key: 'student.birthdate', label: 'Fecha de nacimiento' },
    { group: 'Estudiante', key: 'student.birthdateLong', label: 'Fecha de nacimiento (texto)' },
    { group: 'Estudiante', key: 'student.age', label: 'Edad' },
    { group: 'Estudiante', key: 'student.gender', label: 'Sexo (M/F)' },
    { group: 'Estudiante', key: 'student.article', label: 'Artículo (el/la)' },
    { group: 'Estudiante', key: 'student.articleUpper', label: 'Artículo mayúscula (El/La)' },
    // Institution
    { group: 'Institución', key: 'institution.name', label: 'Nombre de la institución' },
    { group: 'Institución', key: 'institution.code', label: 'Código' },
    { group: 'Institución', key: 'institution.address', label: 'Dirección' },
    { group: 'Institución', key: 'institution.phone', label: 'Teléfono' },
    { group: 'Institución', key: 'institution.municipality', label: 'Municipio' },
    { group: 'Institución', key: 'institution.state', label: 'Estado' },
    { group: 'Institución', key: 'institution.director', label: 'Director' },
    { group: 'Institución', key: 'institution.directorDocument', label: 'Cédula del director' },
    // Academic
    { group: 'Académico', key: 'grade.name', label: 'Grado/Año (ej: Quinto año)' },
    { group: 'Académico', key: 'grade.nameUpper', label: 'Grado/Año mayúsculas (ej: QUINTO AÑO)' },
    { group: 'Académico', key: 'grade.ordinal', label: 'Grado ordinal (ej: 5to)' },
    { group: 'Académico', key: 'section.name', label: 'Sección' },
    { group: 'Académico', key: 'section.nameUpper', label: 'Sección mayúsculas' },
    { group: 'Académico', key: 'period.name', label: 'Período escolar' },
    // Date
    { group: 'Fecha', key: 'date', label: 'Fecha actual (corta)' },
    { group: 'Fecha', key: 'date.long', label: 'Fecha actual (texto)' },
    { group: 'Fecha', key: 'date.day', label: 'Día (número)' },
    { group: 'Fecha', key: 'date.dayOrdinal', label: 'Día ordinal (ej: 1ero)' },
    { group: 'Fecha', key: 'date.month', label: 'Mes' },
    { group: 'Fecha', key: 'date.monthUpper', label: 'Mes mayúscula' },
    { group: 'Fecha', key: 'date.year', label: 'Año' },
    // Custom (user fills these when generating)
    { group: 'Campos personalizados', key: 'custom.title', label: 'Título/Cargo (ej: Docente)' },
    { group: 'Campos personalizados', key: 'custom.reason', label: 'Motivo/Concepto' },
    { group: 'Campos personalizados', key: 'custom.recipient', label: 'Dirigido a' },
    { group: 'Campos personalizados', key: 'custom.extra1', label: 'Campo libre 1' },
    { group: 'Campos personalizados', key: 'custom.extra2', label: 'Campo libre 2' },
    { group: 'Campos personalizados', key: 'custom.extra3', label: 'Campo libre 3' },
  ];
  return res.json(variables);
};
