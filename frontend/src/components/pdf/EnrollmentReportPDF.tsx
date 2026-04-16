import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';
import type { SnapshotData, GuardianSnapshot } from '@/services/enrollmentReportService';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderBottom: '2px solid #1a3a5c',
    paddingBottom: 8,
  },
  logo: {
    width: 55,
    height: 55,
    marginRight: 12,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  institutionName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    color: '#1a3a5c',
  },
  subtitle: {
    fontSize: 8,
    color: '#555',
    textAlign: 'center',
    marginTop: 2,
  },
  titleBar: {
    backgroundColor: '#1a3a5c',
    color: '#fff',
    padding: '6 12',
    marginBottom: 10,
    marginTop: 6,
    textAlign: 'center',
  },
  titleText: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
  },
  // Info badges row
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f4f8',
    borderRadius: 4,
    padding: '4 10',
    border: '1px solid #d0d8e0',
  },
  badgeLabel: {
    fontSize: 7,
    color: '#666',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginRight: 4,
  },
  badgeValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#1a3a5c',
  },
  // Section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
    borderBottom: '1px solid #ccc',
    paddingBottom: 3,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1a3a5c',
    textTransform: 'uppercase',
  },
  // Table
  table: {
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5px solid #e0e0e0',
    minHeight: 18,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#f8fafb',
  },
  tableCellLabel: {
    width: '35%',
    padding: '3 6',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#555',
    textTransform: 'uppercase',
  },
  tableCellValue: {
    width: '65%',
    padding: '3 6',
    fontSize: 9,
  },
  // Two columns
  twoCol: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
  // Documents checklist
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    paddingLeft: 4,
  },
  checkBox: {
    width: 10,
    height: 10,
    border: '1px solid #999',
    marginRight: 6,
    textAlign: 'center',
    fontSize: 7,
    lineHeight: 1.3,
  },
  checkBoxChecked: {
    backgroundColor: '#1a3a5c',
    color: '#fff',
    border: '1px solid #1a3a5c',
  },
  checkLabel: {
    fontSize: 8,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 30,
    right: 30,
  },
  footerLine: {
    borderTop: '1px solid #ccc',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: '#999',
  },
  // Signature area
  signatureArea: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  signatureBlock: {
    alignItems: 'center',
    width: 180,
  },
  signatureLine: {
    borderTop: '1px solid #333',
    width: '100%',
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: '#555',
    fontFamily: 'Helvetica-Bold',
  },
});

const escolaridadLabels: Record<string, string> = {
  regular: 'Regular',
  repitiente: 'Repitiente',
  materia_pendiente: 'Materia Pendiente',
};

interface TableRowProps {
  label: string;
  value: string | undefined | null;
  index: number;
}

const TableRow: React.FC<TableRowProps> = ({ label, value, index }) => (
  <View style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
    <Text style={styles.tableCellLabel}>{label}</Text>
    <Text style={styles.tableCellValue}>{value || '—'}</Text>
  </View>
);

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

const GuardianTable: React.FC<{ guardian: GuardianSnapshot; title: string }> = ({
  guardian,
  title,
}) => {
  const rows = [
    { label: 'Nombre', value: `${guardian.firstName} ${guardian.lastName}` },
    { label: 'Documento', value: `${guardian.documentType}-${guardian.document}` },
    { label: 'Teléfono', value: guardian.phone },
    { label: 'Email', value: guardian.email },
    { label: 'Ocupación', value: guardian.occupation },
    {
      label: 'Residencia',
      value: [guardian.residenceParish, guardian.residenceMunicipality, guardian.residenceState]
        .filter(Boolean)
        .join(', '),
    },
    { label: 'Dirección', value: guardian.address },
  ];

  return (
    <View>
      <SectionHeader title={title} />
      <View style={styles.table}>
        {rows.map((r, i) => (
          <TableRow key={r.label} label={r.label} value={r.value} index={i} />
        ))}
      </View>
    </View>
  );
};

interface EnrollmentReportPDFProps {
  data: SnapshotData;
  uuid: string;
  createdAt: string;
  logoBase64?: string | null;
}

const EnrollmentReportPDF: React.FC<EnrollmentReportPDFProps> = ({
  data,
  uuid,
  createdAt,
  logoBase64,
}) => {
  const { institution, period, grade, student, mother, father, representative } = data;

  const genderLabel = student.gender === 'M' ? 'Masculino' : 'Femenino';
  const birthPlace = [student.birthParish, student.birthMunicipality, student.birthState]
    .filter(Boolean)
    .join(', ');
  const residencePlace = [student.residenceParish, student.residenceMunicipality, student.residenceState]
    .filter(Boolean)
    .join(', ');

  const documentChecks = data.documents
    ? [
        { label: 'Partida de Nacimiento', checked: data.documents.receivedPartidaNacimiento },
        { label: 'Certificado de Aprendizaje', checked: data.documents.receivedCertificadoAprendizaje },
        { label: 'Carta de Buena Conducta', checked: data.documents.receivedCartaBuenaConducta },
        { label: 'Notas Certificadas', checked: data.documents.receivedNotasCertificadas },
        { label: 'Copia Cédula Estudiante', checked: data.documents.receivedCopiaCedulaEstudiante },
        { label: 'Informes Médicos', checked: data.documents.receivedInformesMedicos },
        { label: 'Foto Carnet Estudiante', checked: data.documents.receivedFotoCarnetEstudiante },
      ]
    : [];

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          {logoBase64 && <Image style={styles.logo} src={logoBase64} />}
          <View style={styles.headerCenter}>
            <Text style={styles.institutionName}>{institution.name}</Text>
            {institution.deaCode ? (
              <Text style={styles.subtitle}>Código DEA: {institution.deaCode}</Text>
            ) : null}
            <Text style={styles.subtitle}>República Bolivariana de Venezuela</Text>
          </View>
          {logoBase64 && <View style={{ width: 55 }} />}
        </View>

        {/* Title */}
        <View style={styles.titleBar}>
          <Text style={styles.titleText}>PLANILLA DE INSCRIPCIÓN</Text>
        </View>

        {/* Badges: Period, Grade, Escolaridad */}
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Período: </Text>
            <Text style={styles.badgeValue}>{period.name}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Grado: </Text>
            <Text style={styles.badgeValue}>{grade.name}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Condición: </Text>
            <Text style={styles.badgeValue}>
              {escolaridadLabels[data.escolaridad] || data.escolaridad}
            </Text>
          </View>
        </View>

        {/* Student Data */}
        <SectionHeader title="Datos del Estudiante" />
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <View style={styles.table}>
              <TableRow label="Nombres" value={student.firstName} index={0} />
              <TableRow label="Apellidos" value={student.lastName} index={1} />
              <TableRow label="Documento" value={`${student.documentType}-${student.document}`} index={2} />
              <TableRow label="Género" value={genderLabel} index={3} />
              <TableRow label="Fecha de Nac." value={student.birthdate || undefined} index={4} />
            </View>
          </View>
          <View style={styles.col}>
            <View style={styles.table}>
              <TableRow label="Lugar de Nac." value={birthPlace} index={0} />
              <TableRow label="Residencia" value={residencePlace} index={1} />
              <TableRow label="Dirección" value={student.address} index={2} />
              <TableRow label="Teléfono" value={student.phone1} index={3} />
              <TableRow label="Email" value={student.email} index={4} />
            </View>
          </View>
        </View>

        {student.pathology && (
          <View style={styles.table}>
            <TableRow label="Patología" value={student.pathology} index={0} />
          </View>
        )}
        {student.livingWith && (
          <View style={styles.table}>
            <TableRow label="Vive con" value={student.livingWith} index={1} />
          </View>
        )}

        {/* Guardians */}
        <View style={styles.twoCol}>
          <View style={styles.col}>
            {mother && <GuardianTable guardian={mother} title="Datos de la Madre" />}
          </View>
          <View style={styles.col}>
            {father && <GuardianTable guardian={father} title="Datos del Padre" />}
          </View>
        </View>

        {representative && (
          <GuardianTable
            guardian={representative.data}
            title={`Representante Legal (${representative.relationship === 'mother' ? 'Madre' : representative.relationship === 'father' ? 'Padre' : 'Otro'})`}
          />
        )}

        {/* Previous Schools */}
        {data.previousSchools.length > 0 && (
          <View>
            <SectionHeader title="Plantel de Procedencia" />
            <View style={styles.table}>
              {data.previousSchools.map((school, i) => (
                <TableRow
                  key={i}
                  label={`Plantel ${i + 1}`}
                  value={`${school.plantelName}${school.plantelCode ? ` (${school.plantelCode})` : ''}${school.state ? ` — ${school.state}` : ''}`}
                  index={i}
                />
              ))}
            </View>
          </View>
        )}

        {/* Enrollment Answers */}
        {data.enrollmentAnswers.length > 0 && (
          <View>
            <SectionHeader title="Información Socio-Educativa" />
            <View style={styles.table}>
              {data.enrollmentAnswers.map((qa, i) => (
                <TableRow
                  key={i}
                  label={qa.prompt}
                  value={Array.isArray(qa.answer) ? qa.answer.join(', ') : qa.answer}
                  index={i}
                />
              ))}
            </View>
          </View>
        )}

        {/* Documents Checklist */}
        {documentChecks.length > 0 && (
          <View>
            <SectionHeader title="Documentos Consignados" />
            <View style={styles.twoCol}>
              <View style={styles.col}>
                {documentChecks.slice(0, 4).map((item) => (
                  <View key={item.label} style={styles.checkItem}>
                    <Text
                      style={[
                        styles.checkBox,
                        item.checked ? styles.checkBoxChecked : {},
                      ]}
                    >
                      {item.checked ? '✓' : ' '}
                    </Text>
                    <Text style={styles.checkLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.col}>
                {documentChecks.slice(4).map((item) => (
                  <View key={item.label} style={styles.checkItem}>
                    <Text
                      style={[
                        styles.checkBox,
                        item.checked ? styles.checkBoxChecked : {},
                      ]}
                    >
                      {item.checked ? '✓' : ' '}
                    </Text>
                    <Text style={styles.checkLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Signature Area */}
        <View style={styles.signatureArea}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Firma del Representante</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Sello de la Institución</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View style={styles.footerLine}>
            <Text style={styles.footerText}>ID: {uuid}</Text>
            <Text style={styles.footerText}>
              Generado: {new Date(createdAt).toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' })}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default EnrollmentReportPDF;
