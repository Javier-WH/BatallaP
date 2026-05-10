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
  // Detail table
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

export interface EvaluationPlanItemData {
  identificador: string;
  description: string;
  tecnica: string;
  objetivo?: string;
  tipoEvaluacion?: string;
  formaEvaluacion?: string;
  indicador?: string | string[];
  temaGenerador?: string;
  referentesTeoricos?: string | string[];
  referentesEticos?: string | string[];
  estrategiaEvaluacion?: string;
  percentage: number;
  date: string;
}

const bulletList = (val: string | string[] | undefined): string => {
  if (!val) return '-';
  const items = typeof val === 'string' ? (() => { try { return JSON.parse(val); } catch { return [val]; } })() : val;
  if (Array.isArray(items) && items.length > 0) {
    return items.map((t: string) => `• ${t}`).join('\n');
  }
  return '-';
};

const bulletTags = (val: string | string[] | undefined): string => {
  if (!val) return '-';
  const items = typeof val === 'string' ? (() => { try { return JSON.parse(val); } catch { return [val]; } })() : val;
  if (Array.isArray(items) && items.length > 0) {
    return items.join(', ');
  }
  return '-';
};

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
  items: EvaluationPlanItemData[];
  logoBase64?: string | null;
  institutionName: string;
}

const SummaryHeader = () => (
  <View style={styles.tableHeader}>
    <Text style={[styles.cellHeader, { width: '7%' }]}>ID</Text>
    <Text style={[styles.cellHeader, { width: '12%' }]}>Tema Generador</Text>
    <Text style={[styles.cellHeader, { width: '13%' }]}>Ref. Teóricos</Text>
    <Text style={[styles.cellHeader, { width: '13%' }]}>Ref. Éticos e Indis.</Text>
    <Text style={[styles.cellHeader, { width: '11%' }]}>Técnicas e Instrumento</Text>
    <Text style={[styles.cellHeader, { width: '12%' }]}>Estrategia de eval.</Text>
    <Text style={[styles.cellHeader, { width: '13%' }]}>Indicador</Text>
    <Text style={[styles.cellHeader, { width: '7%' }]}>Puntaje</Text>
    <Text style={[styles.cellHeader, { width: '7%' }]}>Fecha</Text>
  </View>
);

const summaryRow = (item: EvaluationPlanItemData, index: number) => (
  <View key={index} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
    <Text style={[styles.cellCenter, { width: '7%' }]}>{item.identificador || '-'}</Text>
    <Text style={[styles.cell, { width: '12%' }]}>{item.temaGenerador || '-'}</Text>
    <Text style={[styles.cell, { width: '13%', fontSize: 6 }]}>{bulletList(item.referentesTeoricos)}</Text>
    <Text style={[styles.cell, { width: '13%', fontSize: 6 }]}>{bulletTags(item.referentesEticos)}</Text>
    <Text style={[styles.cell, { width: '11%' }]}>{item.tecnica || '-'}</Text>
    <Text style={[styles.cell, { width: '12%' }]}>{item.description || '-'}</Text>
    <Text style={[styles.cell, { width: '13%', fontSize: 6 }]}>{bulletList(item.indicador)}</Text>
    <Text style={[styles.cellCenter, { width: '7%' }]}>{item.percentage}%</Text>
    <Text style={[styles.cellCenter, { width: '7%' }]}>{item.date ? new Date(item.date).toLocaleDateString('es-VE') : '-'}</Text>
  </View>
);

const EvaluationPlanPDF: React.FC<EvaluationPlanPDFProps> = ({ header, items, logoBase64, institutionName }) => {
  const totalPeso = items.reduce((acc, i) => acc + (i.percentage || 0), 0);

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

        {/* Summary Table */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Resumen del Plan</Text>
        </View>
        <View style={styles.summaryTable}>
          <SummaryHeader />
          {items.map((item, i) => summaryRow(item, i))}
        </View>

        {/* Weight summary */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Puntaje Total: </Text>
            <Text style={styles.badgeValue}>{totalPeso}%</Text>
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