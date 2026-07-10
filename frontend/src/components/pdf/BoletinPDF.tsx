import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';

export interface BoletinTerm { id: number; name: string; order: number | null; }
export interface BoletinSubject {
  id: number;
  name: string;
  lapsos: { termId: number; termName: string; score: number }[];
  finalScore: number | null;
  status: string;
}
export interface BoletinStudent {
  inscriptionId: number;
  firstName: string;
  lastName: string;
  document: string;
  sectionName: string;
  subjects: BoletinSubject[];
}
export interface BoletinData {
  institution: { name: string; period: string; code: string; principal: string };
  grade: { id: number; name: string };
  terms: BoletinTerm[];
  students: BoletinStudent[];
}

const styles = StyleSheet.create({
  page: {
    padding: 35,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  header: {
    textAlign: 'center',
    marginBottom: 12,
    borderBottom: '2px solid #1a3a5c',
    paddingBottom: 8,
  },
  institutionName: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    color: '#1a3a5c',
  },
  subtitle: {
    fontSize: 8,
    color: '#555',
    marginTop: 2,
  },
  titleBar: {
    backgroundColor: '#1a3a5c',
    color: '#fff',
    padding: '5 0',
    marginBottom: 10,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },
  studentInfo: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  infoField: {
    flexDirection: 'row',
  },
  infoLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#666',
    marginRight: 4,
  },
  infoValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  table: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1a3a5c',
    color: '#fff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
  },
  tableRow: {
    flexDirection: 'row',
    fontSize: 9,
    borderBottom: '1px solid #e2e8f0',
  },
  tableRowAlt: {
    flexDirection: 'row',
    fontSize: 9,
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  colSubject: {
    flex: 3,
    padding: '5 8',
    fontFamily: 'Helvetica-Bold',
  },
  colTerm: {
    flex: 1,
    padding: '5 4',
    textAlign: 'center',
  },
  colFinal: {
    flex: 1.2,
    padding: '5 4',
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
  },
  colHeader: {
    padding: '5 4',
    textAlign: 'center',
  },
  colSubjectHeader: {
    flex: 3,
    padding: '5 8',
    textAlign: 'left',
  },
  footer: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBlock: {
    textAlign: 'center',
    fontSize: 8,
  },
  signatureLine: {
    borderTop: '1px solid #333',
    width: 180,
    marginTop: 24,
    marginBottom: 4,
  },
});

const formatScore = (score: number | null): string => {
  if (score === null || score === undefined) return '';
  const n = Number(score);
  if (isNaN(n) || n === 0) return '';
  return n.toFixed(1);
};

const BoletinStudentPage: React.FC<{
  student: BoletinStudent;
  institution: BoletinData['institution'];
  grade: BoletinData['grade'];
  terms: BoletinTerm[];
  studentIndex: number;
}> = ({ student, institution, grade, terms, studentIndex }) => {
  return (
    <Page size="LETTER" style={styles.page} key={studentIndex}>
      <View style={styles.header}>
        <Text style={styles.institutionName}>{institution.name}</Text>
        <Text style={styles.subtitle}>Código DEA: {institution.code}   |   Período Escolar: {institution.period}</Text>
      </View>

      <View style={styles.titleBar}>
        <Text>BOLETÍN DE CALIFICACIONES</Text>
      </View>

      <View style={styles.studentInfo}>
        <View style={styles.infoField}>
          <Text style={styles.infoLabel}>Alumno(a):</Text>
          <Text style={styles.infoValue}>{student.lastName} {student.firstName}</Text>
        </View>
        <View style={styles.infoField}>
          <Text style={styles.infoLabel}>Cédula:</Text>
          <Text style={styles.infoValue}>{student.document || '—'}</Text>
        </View>
        <View style={styles.infoField}>
          <Text style={styles.infoLabel}>Grado:</Text>
          <Text style={styles.infoValue}>{grade.name}</Text>
        </View>
        <View style={styles.infoField}>
          <Text style={styles.infoLabel}>Sección:</Text>
          <Text style={styles.infoValue}>{student.sectionName || '—'}</Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader} fixed>
          <Text style={styles.colSubjectHeader}>ASIGNATURA</Text>
          {terms.map((t) => (
            <Text key={t.id} style={{ flex: 1, ...styles.colHeader, fontSize: 7, padding: '5 2' }}>
              {t.name}
            </Text>
          ))}
          <Text style={{ flex: 1.2, ...styles.colHeader }}>DEFINITIVA</Text>
        </View>

        {student.subjects.map((subj, idx) => {
          const rowStyle = idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt;
          return (
            <View key={subj.id} style={rowStyle} wrap={false}>
              <Text style={styles.colSubject}>{subj.name}</Text>
              {terms.map((t) => {
                const lapseScore = subj.lapsos.find((l) => l.termId === t.id);
                return (
                  <Text key={t.id} style={styles.colTerm}>
                    {formatScore(lapseScore ? lapseScore.score : 0)}
                  </Text>
                );
              })}
              <Text style={styles.colFinal}>{formatScore(subj.finalScore)}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <View style={styles.signatureBlock}>
          <View style={styles.signatureLine} />
          <Text>{institution.principal || 'Director(a)'}</Text>
        </View>
        <View style={styles.signatureBlock}>
          <View style={styles.signatureLine} />
          <Text>Docente</Text>
        </View>
      </View>
    </Page>
  );
};

interface BoletinPDFProps {
  data: BoletinData;
}

const BoletinPDF: React.FC<BoletinPDFProps> = ({ data }) => {
  return (
    <Document>
      {data.students.map((student, idx) => (
        <BoletinStudentPage
          key={student.inscriptionId}
          student={student}
          institution={data.institution}
          grade={data.grade}
          terms={data.terms}
          studentIndex={idx}
        />
      ))}
    </Document>
  );
};

export default BoletinPDF;