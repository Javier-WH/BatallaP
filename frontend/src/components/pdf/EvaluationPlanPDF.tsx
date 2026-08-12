import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 25,
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderBottom: '2px solid #1a3a5c',
    paddingBottom: 6,
  },
  logo: {
    width: 45,
    height: 45,
    marginRight: 10,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  institutionName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    color: '#1a3a5c',
  },
  subtitle: {
    fontSize: 7,
    color: '#555',
    textAlign: 'center',
    marginTop: 1,
  },
  titleBar: {
    backgroundColor: '#1a3a5c',
    color: '#fff',
    padding: '4 10',
    marginBottom: 8,
    textAlign: 'center',
  },
  titleText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f4f8',
    borderRadius: 4,
    padding: '3 8',
    border: '1px solid #d0d8e0',
  },
  badgeLabel: {
    fontSize: 7,
    color: '#666',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginRight: 3,
  },
  badgeValue: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#1a3a5c',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
    borderBottom: '1px solid #ccc',
    paddingBottom: 2,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#1a3a5c',
    textTransform: 'uppercase',
  },
  // Main table for summary
  summaryTable: {
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1a3a5c',
    color: '#fff',
    minHeight: 16,
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5px solid #e0e0e0',
    minHeight: 16,
    alignItems: 'flex-start',
    paddingVertical: 3,
  },
  tableRowAlt: {
    backgroundColor: '#f8fafb',
  },
  cell: {
    padding: '2 4',
    fontSize: 7,
  },
  cellCenter: {
    padding: '2 4',
    fontSize: 7,
    textAlign: 'center',
  },
  cellHeader: {
    padding: '2 4',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  planningTable: {
    border: '0.75px solid #666',
  },
  planningHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#d9e2f3',
    minHeight: 18,
    alignItems: 'stretch',
  },
  planningHeaderCell: {
    borderRight: '0.5px solid #666',
    borderBottom: '0.5px solid #666',
    padding: '2 1',
    fontSize: 4.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    justifyContent: 'center',
  },
  planningSubheaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f2f2f2',
    height: 12,
    alignItems: 'stretch',
  },
  planningBodyRow: {
    flexDirection: 'row',
    borderBottom: '0.5px solid #aaa',
    minHeight: 22,
    alignItems: 'stretch',
  },
  planningCell: {
    borderRight: '0.5px solid #aaa',
    padding: '2 1',
    fontSize: 4.5,
    lineHeight: 1.1,
  },
  planningCellCenter: {
    borderRight: '0.5px solid #aaa',
    padding: '2 1',
    fontSize: 4.5,
    lineHeight: 1.1,
    textAlign: 'center',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 25,
    right: 25,
  },
  footerLine: {
    borderTop: '1px solid #ccc',
    paddingTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 6,
    color: '#999',
  },
});

export interface EvaluationPlanRowData {
  component: string;
  content: string;
  learnings: string;
  strategy: string;
  tecnica: string;
  instrumento: string;
  criterion: string;
  indicator: string;
  points: number | string;
  criterionTotalPoints: number | string;
  intra: boolean;
  inter: boolean;
  trans: boolean;
  date: string;
  percentage: number | string;
}


export interface EvaluationPlanHeaderData {
  periodName: string;
  gradeName: string;
  subjectName: string;
  sectionName: string;
  termName: string;
  teacherName: string;
}

interface EvaluationPlanPDFProps {
  header: EvaluationPlanHeaderData;
  rows: EvaluationPlanRowData[];
  totalPercentage: number;
  logoBase64?: string | null;
  institutionName: string;
}

const planningColumns = [
  { label: 'COMPONENTE TEMÁTICO', width: '9.4%' },
  { label: 'CONTENIDO', width: '10.9%' },
  { label: 'APRENDIZAJES ESPERADOS', width: '12.5%' },
  { label: 'ESTRATEGIA DE APRENDIZAJE', width: '10.9%' },
  { label: 'TÉCNICA', width: '7%' },
  { label: 'INSTRUMENTO', width: '7%' },
  { label: 'CRITERIOS', width: '10.9%' },
  { label: 'INDICADORES', width: '11.7%' },
  { label: 'PUNTOS', width: '1.45%' },
  { label: 'PUNTOS', width: '1.45%' },
  { label: 'INTRA', width: '2.23%' },
  { label: 'INTER', width: '2.23%' },
  { label: 'TRANS', width: '2.23%' },
  { label: 'FECHA', width: '5.46%' },
  { label: 'PORCENTAJE', width: '4.68%' },
];

const PlanningHeader = () => (
  <View>
    <View style={styles.planningHeaderRow}>
      {planningColumns.slice(0, 8).map((column) => (
        <Text key={column.label} style={[styles.planningHeaderCell, { width: column.width, height: 30 }]}>
          {column.label}
        </Text>
      ))}
      <Text style={[styles.planningHeaderCell, { width: '2.9%', height: 30 }]}>PUNTOS</Text>
      <Text style={[styles.planningHeaderCell, { width: '6.69%', height: 15 }]}>TIPO DE EVALUACIÓN</Text>
      <Text style={[styles.planningHeaderCell, { width: '5.46%', height: 30 }]}>FECHA</Text>
      <Text style={[styles.planningHeaderCell, { width: '4.68%', height: 30 }]}>PORCENTAJE</Text>
    </View>
    <View style={styles.planningSubheaderRow}>
      <View style={{ width: '80.02%' }} />
      <Text style={[styles.planningHeaderCell, { width: '2.23%' }]}>INTRA</Text>
      <Text style={[styles.planningHeaderCell, { width: '2.23%' }]}>INTER</Text>
      <Text style={[styles.planningHeaderCell, { width: '2.23%' }]}>TRANS</Text>
      <View style={{ width: '13.29%' }} />
    </View>
  </View>
);

const planningRow = (row: EvaluationPlanRowData, index: number) => {
  const values = [
    row.component || '', row.content || '', row.learnings || '', row.strategy || '',
    row.tecnica || '', row.instrumento || '', row.criterion || '', row.indicator || '',
    row.points === '' ? '' : String(row.points),
    row.criterionTotalPoints === '' ? '' : String(row.criterionTotalPoints),
    row.intra ? 'X' : '', row.inter ? 'X' : '', row.trans ? 'X' : '',
    row.date || '', row.percentage === '' ? '' : `${row.percentage}%`,
  ];

  return (
    <View key={index} style={[styles.planningBodyRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
      {values.map((value, valueIndex) => (
        <Text
          key={`${index}-${valueIndex}`}
          style={[styles.planningCell, { width: planningColumns[valueIndex].width }, valueIndex >= 8 ? styles.planningCellCenter : {}]}
        >
          {value}
        </Text>
      ))}
    </View>
  );
};

const EvaluationPlanPDF: React.FC<EvaluationPlanPDFProps> = ({ header, rows, totalPercentage, logoBase64, institutionName }) => {

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          {logoBase64 && <Image style={styles.logo} src={logoBase64} />}
          <View style={styles.headerCenter}>
            {institutionName ? (
              <Text style={styles.institutionName}>{institutionName}</Text>
            ) : null}
            <Text style={styles.subtitle}>República Bolivariana de Venezuela</Text>
          </View>
          {logoBase64 && <View style={{ width: 45 }} />}
        </View>

        {/* Title */}
        <View style={styles.titleBar}>
          <Text style={styles.titleText}>PLAN DE EVALUACIÓN</Text>
        </View>

        {/* Badges */}
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Período: </Text>
            <Text style={styles.badgeValue}>{header.periodName}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Grado: </Text>
            <Text style={styles.badgeValue}>{header.gradeName}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Materia: </Text>
            <Text style={styles.badgeValue}>{header.subjectName}</Text>
          </View>
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Sección: </Text>
            <Text style={styles.badgeValue}>{header.sectionName}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Lapso: </Text>
            <Text style={styles.badgeValue}>{header.termName}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Profesor: </Text>
            <Text style={styles.badgeValue}>{header.teacherName || '-'}</Text>
          </View>
        </View>

        {/* Planning Table */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Planificación</Text>
        </View>
        <View style={styles.planningTable}>
          <PlanningHeader />
          {rows.map((row, i) => planningRow(row, i))}
        </View>

        {/* Weight summary */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Puntaje Total: </Text>
            <Text style={styles.badgeValue}>{totalPercentage}%</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View style={styles.footerLine}>
            <Text style={styles.footerText}>BatallaProject - Sistema de Gestión Escolar</Text>
            <Text style={styles.footerText}>
              Generado: {new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' })}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default EvaluationPlanPDF;