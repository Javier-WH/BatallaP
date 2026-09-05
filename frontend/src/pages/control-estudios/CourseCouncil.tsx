import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { Card, Button, Table, Space, Typography, Row, Col, Tag, Input, Empty, Spin, message, Tooltip, Alert, Breadcrumb, Checkbox, Modal } from 'antd';
import {
  LeftOutlined,
  SaveOutlined,
  FilterOutlined,
  CalendarOutlined,
  UserOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  FileExcelOutlined
} from '@ant-design/icons';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import api from '@/services/api';
import { useGradeRounding } from '@/context/GradeRoundingContext';
import { useSchool } from '@/context/SchoolContext';
import { formatGrade, isPassingGrade, roundGrade } from '@/utils/gradeFormat';
import { compareStudents } from '@/utils/studentSort';

const { Title, Text } = Typography;

interface Term {
  id: number;
  name: string;
  isBlocked: boolean;
  order: number;
}

interface Section {
  id: number;
  name: string;
}

interface Grade {
  id: number;
  name: string;
  isDiversified: boolean;
  order: number;
}

interface PeriodGradeStructure {
  id: number;
  grade: Grade;
  sections: Section[];
}

interface CouncilStudent {
  id: number;
  studentName: string;
  studentDni: string;
  documentType: string;
  subjects: {
    id: number;
    name: string;
    groupId?: number | null;
    groupName?: string | null;
    inscriptionSubjectId: number;
    points: number;
    councilPointId?: number;
    grade: number;
    includeInAverage?: boolean;
    hasOtherTermsPoints: boolean;
    otherTermsInfo?: { termName: string, points: number }[];
    previousTermsData?: {
      termId: number;
      termName: string;
      baseGrade: number;
      councilPoints: number;
      finalGrade: number;
    }[];
  }[];
}

/* ------------------------------------------------------------------ */
/* Standalone Excel builder — reused by single-section and bulk export */
/* ------------------------------------------------------------------ */
interface CouncilExcelParams {
  students: CouncilStudent[];
  columnDefs: { title: string; key: string; groupId?: number; subjectId?: number }[];
  prevTerms: { termId: number; termName: string }[];
  term: Term;
  section: { section: Section; grade: Grade };
  guideTeacher: string;
  completedAt: Date | null;
  allTerms: Term[];
  showPrevTerms: boolean;
  showPrevCouncilPts: boolean;
  rounding: boolean;
  passingGrade: number;
  maxGrade: number;
  institutionName: string;
  periodName: string;
  isPreliminary: boolean;
}

async function buildCouncilWorkbook(p: CouncilExcelParams): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BatallaProject';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('Consejo de Curso', {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }
    }
  });
  worksheet.pageSetup.printTitlesRow = '6:7';

  const fixedHeaders = ['#', 'Documento', 'Estudiante', 'Pos', 'Promedio', 'Rep'];
  const leafHeaders: string[] = [...fixedHeaders];
  const groupRanges: { title: string; start: number; end: number }[] = [
    { title: 'Información del estudiante', start: 1, end: fixedHeaders.length }
  ];

  const currentLapNum = (p.term.name?.match(/\d+/)?.[0]) || String(p.term.order ?? 1);
  const termOrderMap = new Map<number, string>();
  p.allTerms.forEach(t => {
    const num = t.name.match(/\d+/)?.[0] || String(t.order);
    termOrderMap.set(t.id, num);
  });

  p.columnDefs.forEach(colDef => {
    const start = leafHeaders.length + 1;
    if (p.showPrevTerms) {
      p.prevTerms.forEach(pt => {
        const lapNum = termOrderMap.get(pt.termId) || '?';
        leafHeaders.push(`L${lapNum}`);
      });
    }
    leafHeaders.push(`L${currentLapNum}`, 'PC', 'NF');
    groupRanges.push({ title: colDef.title, start, end: leafHeaders.length });
  });

  const widthFromPx = (px: number): number => (px - 5) / 7;
  worksheet.getColumn(1).width = 2.86;
  worksheet.getColumn(2).width = 12.86;
  worksheet.getColumn(3).width = 42;
  worksheet.getColumn(4).width = widthFromPx(29);
  worksheet.getColumn(5).width = widthFromPx(57);
  worksheet.getColumn(6).width = widthFromPx(29);
  for (let i = 7; i <= leafHeaders.length; i++) worksheet.getColumn(i).width = 4;

  const colWidths: number[] = [];
  let totalWidth = 0;
  for (let i = 1; i <= leafHeaders.length; i++) {
    const w = worksheet.getColumn(i).width || 0;
    colWidths.push(w);
    totalWidth += w;
  }
  const third = totalWidth / 3;
  let cut1 = 1, cut2 = 1, acc = 0;
  for (let i = 0; i < colWidths.length; i++) {
    acc += colWidths[i];
    if (cut1 === 1 && acc >= third) cut1 = i + 1;
    if (cut2 === 1 && acc >= third * 2) cut2 = i + 1;
  }
  cut1 = Math.max(2, Math.min(cut1, leafHeaders.length - 2));
  cut2 = Math.max(cut1 + 1, Math.min(cut2, leafHeaders.length - 1));
  const lastCol = leafHeaders.length;

  for (let r = 1; r <= 5; r++) worksheet.addRow([]);

  worksheet.mergeCells(1, 1, 1, cut1);
  worksheet.mergeCells(1, cut1 + 1, 1, cut2);
  worksheet.mergeCells(1, cut2 + 1, 1, lastCol);
  const nameCell = worksheet.getCell(1, cut1 + 1);
  nameCell.value = p.institutionName;
  nameCell.alignment = { horizontal: 'center', vertical: 'middle' };
  nameCell.font = { bold: true, size: 20, color: { argb: '17324D' } };
  worksheet.getRow(1).height = 48;

  worksheet.mergeCells(3, cut2 + 1, 3, lastCol);
  const periodCell = worksheet.getCell(3, cut2 + 1);
  periodCell.value = p.periodName || '';
  periodCell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
  periodCell.font = { bold: true, size: 14, color: { argb: '17324D' } };

  worksheet.mergeCells(4, 1, 4, 2);
  const profesorLabelCell = worksheet.getCell(4, 1);
  profesorLabelCell.value = 'Profesor:';
  profesorLabelCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  profesorLabelCell.font = { size: 14, color: { argb: '17324D' } };
  const profesorNameCell = worksheet.getCell(4, 3);
  profesorNameCell.value = p.guideTeacher
    ? p.guideTeacher.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
    : '';
  profesorNameCell.alignment = { horizontal: 'left', vertical: 'middle' };
  profesorNameCell.font = { bold: true, size: 14, color: { argb: '17324D' } };

  worksheet.mergeCells(4, cut1 + 1, 4, cut2);
  const titleCell = worksheet.getCell(4, cut1 + 1);
  titleCell.value = p.isPreliminary ? 'Acta Preliminar - Consejos de Curso' : 'Acta Final - Consejos de Curso';
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.font = { bold: true, size: 14, color: { argb: '17324D' } };

  worksheet.mergeCells(4, cut2 + 1, 4, lastCol);
  const dateCell = worksheet.getCell(4, cut2 + 1);
  dateCell.value = p.completedAt
    ? `Fecha: ${p.completedAt.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
    : 'Fecha: __/__/____';
  dateCell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
  dateCell.font = { size: 14, color: { argb: '17324D' } };

  worksheet.mergeCells(5, 1, 5, 2);
  const cursoLabelCell = worksheet.getCell(5, 1);
  cursoLabelCell.value = 'Curso:';
  cursoLabelCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  cursoLabelCell.font = { size: 14, color: { argb: '17324D' } };
  const cursoNameCell = worksheet.getCell(5, 3);
  const cursoGradeName = p.section.grade.name || '';
  const cursoSectionName = p.section.section.name?.replace(/sección/gi, '').trim() || '';
  cursoNameCell.value = `${cursoGradeName}, Sección ${cursoSectionName}`.trim();
  cursoNameCell.alignment = { horizontal: 'left', vertical: 'middle' };
  cursoNameCell.font = { bold: true, size: 14, color: { argb: '17324D' } };

  worksheet.mergeCells(5, cut1 + 1, 5, cut2);
  const lapsoCell = worksheet.getCell(5, cut1 + 1);
  lapsoCell.value = p.term.name || '';
  lapsoCell.alignment = { horizontal: 'center', vertical: 'middle' };
  lapsoCell.font = { bold: true, size: 14, color: { argb: '17324D' } };

  worksheet.getRow(2).height = 24.75;
  worksheet.getRow(3).height = 24.75;
  worksheet.getRow(4).height = 24.75;
  worksheet.getRow(5).height = 24.75;

  // Logo
  const pxToColUnits = (px: number): number => {
    let remaining = px;
    for (let c = 1; c <= leafHeaders.length; c++) {
      const w = worksheet.getColumn(c).width || 0;
      const colPx = Math.round(w >= 1 ? w * 7 + 5 : w * 7);
      if (remaining <= colPx) return (c - 1) + remaining / colPx;
      remaining -= colPx;
    }
    return leafHeaders.length;
  };
  try {
    const logoResponse = await api.get('/upload/logo', { responseType: 'arraybuffer' });
    const logoBuffer = logoResponse.data as ArrayBuffer;
    const view = new DataView(logoBuffer);
    const pngWidth = view.getUint32(16, false);
    const pngHeight = view.getUint32(20, false);
    const targetHeightPx = Math.round(1.28 * 96);
    const targetWidthPx = pngHeight > 0 ? Math.round((pngWidth / pngHeight) * targetHeightPx) : targetHeightPx;
    const logoId = workbook.addImage({ buffer: logoBuffer, extension: 'png' });
    worksheet.addImage(logoId, {
      tl: { col: pxToColUnits(28), row: 5 / 48 },
      ext: { width: targetWidthPx, height: targetHeightPx }
    });
  } catch { /* no logo */ }

  const topRow = worksheet.addRow([]);
  const headerRow = worksheet.addRow(leafHeaders);
  groupRanges.forEach(range => {
    topRow.getCell(range.start).value = range.title;
    worksheet.mergeCells(6, range.start, 6, range.end);
  });

  const getSubject = (student: CouncilStudent, colDef: typeof p.columnDefs[number]) => (
    colDef.groupId
      ? student.subjects.find(s => s.groupId === colDef.groupId)
      : student.subjects.find(s => s.id === colDef.subjectId)
  );
  const averageOf = (student: CouncilStudent) => {
    const avg = student.subjects.filter(s => s.includeInAverage !== false);
    const total = avg.reduce((sum, s) => sum + Math.max(1, roundGrade((s.grade || 0) + (p.isPreliminary ? 0 : (s.points || 0)))), 0);
    return avg.length > 0 ? Number((total / avg.length).toFixed(2)) : 0;
  };
  const sortedByAvg = [...p.students].sort((a, b) => averageOf(b) - averageOf(a));
  const positionMap = new Map<number, number>();
  sortedByAvg.forEach((s, idx) => positionMap.set(s.id, idx + 1));
  const failedCount = (student: CouncilStudent) =>
    student.subjects.filter(s => !isPassingGrade((s.grade || 0) + (p.isPreliminary ? 0 : (s.points || 0)), p.passingGrade)).length;

  const zebraFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'F7FAFC' } };
  p.students.forEach((student, studentIndex) => {
    const row: (string | number)[] = [
      studentIndex + 1,
      `${student.documentType === 'Venezolano' ? 'V' : student.documentType === 'Extranjero' ? 'E' : student.documentType === 'Pasaporte' ? 'P' : 'CE'}-${student.studentDni}`,
      student.studentName,
      positionMap.get(student.id) ?? studentIndex + 1,
      Number(averageOf(student).toFixed(2)),
      failedCount(student),
    ];
    p.columnDefs.forEach(colDef => {
      const subject = getSubject(student, colDef);
      if (p.showPrevTerms) {
        p.prevTerms.forEach(pt => {
          const prev = subject?.previousTermsData?.find(i => i.termId === pt.termId);
          row.push(prev ? Number(formatGrade(prev.finalGrade, p.rounding)) : '-');
        });
      }
      const baseGrade = subject?.grade ?? 0;
      const points = subject?.points ?? 0;
      row.push(
        subject ? Number(formatGrade(baseGrade, p.rounding)) : '-',
        p.isPreliminary ? '' : points,
        p.isPreliminary ? '' : (subject ? Number(formatGrade(roundGrade((baseGrade + points) * 100) / 100, p.rounding)) : '-'),
      );
    });
    const dataRow = worksheet.addRow(row);
    const isZebraRow = studentIndex % 2 === 1;

    if (p.showPrevTerms && p.showPrevCouncilPts) {
      let colOffset = 6;
      p.columnDefs.forEach(colDef => {
        const subject = getSubject(student, colDef);
        if (p.showPrevTerms) {
          p.prevTerms.forEach(pt => {
            const prev = subject?.previousTermsData?.find(i => i.termId === pt.termId);
            if (prev && prev.councilPoints > 0) {
              const cell = dataRow.getCell(colOffset + 1);
              const gradeStr = String(formatGrade(prev.finalGrade, p.rounding)).padStart(String(p.maxGrade).length, '0');
              cell.value = { richText: [
                { text: gradeStr, font: { size: 10 } },
                { text: `+${prev.councilPoints}`, font: { size: 10, bold: true, vertAlign: 'superscript', color: { argb: 'FF3366FF' } } },
              ]};
            }
            colOffset += 1;
          });
        }
        colOffset += 3;
      });
    }
    dataRow.eachCell(cell => {
      cell.font = { size: 10 };
      if (isZebraRow) cell.fill = zebraFill;
      cell.border = {
        top: { style: 'thin', color: { argb: 'D6DEE5' } }, left: { style: 'thin', color: { argb: 'D6DEE5' } },
        bottom: { style: 'thin', color: { argb: 'D6DEE5' } }, right: { style: 'thin', color: { argb: 'D6DEE5' } }
      };
    });
    dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    for (let ci = 4; ci <= leafHeaders.length; ci++) dataRow.getCell(ci).alignment = { horizontal: 'center', vertical: 'middle' };
    dataRow.getCell(5).numFmt = '0.00';
    const repCell = dataRow.getCell(6);
    if (failedCount(student) > 0) repCell.font = { size: 10, color: { argb: 'FF0000' }, bold: true };

    const maxDigits = String(p.maxGrade).length;
    const gradeNumFmt = '0'.repeat(maxDigits);
    let colIdx = 7;
    p.columnDefs.forEach(() => {
      if (p.showPrevTerms) { p.prevTerms.forEach(() => { dataRow.getCell(colIdx).numFmt = gradeNumFmt; colIdx += 1; }); }
      dataRow.getCell(colIdx).numFmt = gradeNumFmt; colIdx += 1;
      colIdx += 1; // PC
      dataRow.getCell(colIdx).numFmt = gradeNumFmt; colIdx += 1; // NF
    });
  });

  // Signature row
  const signatureRow = worksheet.addRow([]);
  worksheet.mergeCells(signatureRow.number, 1, signatureRow.number, 6);
  const sigLabelCell = signatureRow.getCell(1);
  sigLabelCell.value = 'Firma de los Docentes:';
  sigLabelCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  sigLabelCell.font = { bold: true, size: 10, color: { argb: '17324D' } };
  groupRanges.forEach(range => {
    if (range.title === 'Información del estudiante') return;
    worksheet.mergeCells(signatureRow.number, range.start, signatureRow.number, range.end);
  });
  signatureRow.height = 54;

  // Header styling
  const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'D9EAF7' } };
  const subHeaderFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'F3F6F9' } };
  const headerBorder = {
    top: { style: 'thin' as const, color: { argb: 'B8C7D3' } }, left: { style: 'thin' as const, color: { argb: 'B8C7D3' } },
    bottom: { style: 'thin' as const, color: { argb: 'B8C7D3' } }, right: { style: 'thin' as const, color: { argb: 'B8C7D3' } }
  };
  for (let ci = 1; ci <= leafHeaders.length; ci++) {
    const gc = topRow.getCell(ci);
    gc.fill = headerFill; gc.font = { bold: true, size: 10, color: { argb: '17324D' } };
    gc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; gc.border = headerBorder;
    const lc = headerRow.getCell(ci);
    lc.fill = subHeaderFill; lc.font = { bold: true, size: 9, color: { argb: '40566B' } };
    lc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; lc.border = headerBorder;
  }
  topRow.height = 24; headerRow.height = 32;

  // Thick separators
  const thickEdge = { style: 'medium' as const, color: { argb: '5A7085' } };
  const lastRow = worksheet.rowCount;
  const sigRowNumber = signatureRow.number;
  groupRanges.forEach(range => {
    const mc = worksheet.getCell(6, range.start);
    mc.border = { ...mc.border, left: thickEdge, right: thickEdge };
    for (let rn = 7; rn <= lastRow; rn++) {
      if (rn === sigRowNumber) continue;
      worksheet.getCell(rn, range.start).border = { ...worksheet.getCell(rn, range.start).border, left: thickEdge };
      worksheet.getCell(rn, range.end).border = { ...worksheet.getCell(rn, range.end).border, right: thickEdge };
    }
  });
  for (let ci = 1; ci <= lastCol; ci++) {
    worksheet.getCell(6, ci).border = { ...worksheet.getCell(6, ci).border, top: thickEdge };
    worksheet.getCell(lastRow, ci).border = { ...worksheet.getCell(lastRow, ci).border, bottom: thickEdge };
  }
  for (let ci = 1; ci <= lastCol; ci++) {
    worksheet.getCell(sigRowNumber, ci).border = { ...worksheet.getCell(sigRowNumber, ci).border, top: thickEdge };
  }
  const sigLabelMaster = worksheet.getCell(sigRowNumber, 1);
  sigLabelMaster.border = { ...sigLabelMaster.border, left: thickEdge, right: thickEdge };
  groupRanges.forEach(range => {
    if (range.title === 'Información del estudiante') return;
    const sgm = worksheet.getCell(sigRowNumber, range.start);
    sgm.border = { ...sgm.border, left: thickEdge, right: thickEdge };
  });

  if (p.showPrevTerms && p.prevTerms.length > 0) {
    const doubleEdge = { style: 'double' as const, color: { argb: '5A7085' } };
    const prevColsPerSubject = p.prevTerms.length;
    groupRanges.forEach(range => {
      if (range.title === 'Información del estudiante') return;
      const currentLCol = range.start + prevColsPerSubject;
      for (let rn = 7; rn <= lastRow; rn++) {
        if (rn === sigRowNumber) continue;
        const cell = worksheet.getCell(rn, currentLCol);
        cell.border = { ...cell.border, left: doubleEdge };
      }
    });
  }

  worksheet.pageSetup.printArea = `A1:${worksheet.getColumn(leafHeaders.length).letter}${worksheet.rowCount}`;
  return workbook.xlsx.writeBuffer();
}

/** Compute column definitions and previous term names from council students. */
function computeCouncilColumns(students: CouncilStudent[]) {
  const columnDefs: { title: string; key: string; groupId?: number; subjectId?: number }[] = [];
  const seenGroups = new Set<number>();
  const seenSubjects = new Set<number>();
  students.forEach(student => {
    student.subjects.forEach(sub => {
      if (sub.groupId && sub.groupName) {
        if (!seenGroups.has(sub.groupId)) {
          columnDefs.push({ title: sub.groupName, key: `group-${sub.groupId}`, groupId: sub.groupId });
          seenGroups.add(sub.groupId);
        }
      } else {
        if (!seenSubjects.has(sub.id)) {
          columnDefs.push({ title: sub.name, key: `subject-${sub.id}`, subjectId: sub.id });
          seenSubjects.add(sub.id);
        }
      }
    });
  });
  const prevTerms: { termId: number; termName: string }[] = [];
  if (students.length > 0 && students[0].subjects.length > 0) {
    (students[0].subjects[0].previousTermsData || []).forEach(pt =>
      prevTerms.push({ termId: pt.termId, termName: pt.termName })
    );
  }
  return { columnDefs, prevTerms };
}

const CourseCouncil: React.FC = () => {
  const { viewPeriod, isReadOnly } = useSchool();
  const [step, setStep] = useState(0); // 0: Term, 1: Section, 2: Data
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPreliminary, setExportingPreliminary] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [bulkExportProgress, setBulkExportProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [selectedBulkSections, setSelectedBulkSections] = useState<Set<string>>(new Set());

  const [terms, setTerms] = useState<Term[]>([]);
  const [structure, setStructure] = useState<PeriodGradeStructure[]>([]);

  const [selectedTerm, setSelectedTerm] = useState<Term | null>(null);
  const [selectedSection, setSelectedSection] = useState<{ section: Section, grade: Grade } | null>(null);
  const [studentsData, setStudentsData] = useState<CouncilStudent[]>([]);
  const [pointsLimit, setPointsLimit] = useState<number>(2);
  const [pointsPerSubjectLimit, setPointsPerSubjectLimit] = useState<number>(2);
  const [passingGrade, setPassingGrade] = useState<number>(10);
  const [maxGrade, setMaxGrade] = useState<number>(20);

  const [councilDone, setCouncilDone] = useState(false);
  const [councilCompletedAt, setCouncilCompletedAt] = useState<Date | null>(null);
  const [guideTeacherName, setGuideTeacherName] = useState<string>('');
  const [missingPointsStudents, setMissingPointsStudents] = useState<CouncilStudent[]>([]);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [markingDone, setMarkingDone] = useState(false);
  const [bulkMarking, setBulkMarking] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  const [filterYear, setFilterYear] = useState<string>('');
  const [showPreviousTerms, setShowPreviousTerms] = useState<boolean>(true);
  const [showPrevCouncilPoints, setShowPrevCouncilPoints] = useState<boolean>(false);
  const [tableScrollHeight, setTableScrollHeight] = useState(300);
  const tableCardRef = useRef<HTMLDivElement>(null);
  const { enableRounding } = useGradeRounding();
  const { settings } = useSchool();
  // null = all closed (term globally blocked), array = specific { sectionId, gradeId } closed
  const [closedSections, setClosedSections] = useState<{ sectionId: number; gradeId: number }[] | null>(null);

  const updateTableScrollHeight = useCallback(() => {
    const card = tableCardRef.current;
    if (!card) return;

    const cardTop = card.getBoundingClientRect().top;
    const header = card.querySelector('.ant-table-thead') as HTMLElement | null;
    const stickyScrollbar = card.querySelector('.ant-table-sticky-scroll-bar') as HTMLElement | null;
    const headerHeight = header?.getBoundingClientRect().height ?? 72;
    const scrollbarHeight = stickyScrollbar?.getBoundingClientRect().height ?? 16;
    const availableHeight = window.innerHeight - cardTop;
    const nextHeight = Math.floor(availableHeight - headerHeight - scrollbarHeight - 2);

    setTableScrollHeight(Math.max(120, nextHeight));
  }, []);

  useLayoutEffect(() => {
    if (step !== 2) return;

    const frame = requestAnimationFrame(updateTableScrollHeight);
    const observer = new ResizeObserver(updateTableScrollHeight);
    if (tableCardRef.current) observer.observe(tableCardRef.current);
    window.addEventListener('resize', updateTableScrollHeight);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', updateTableScrollHeight);
    };
  }, [step, studentsData.length, showPreviousTerms, councilDone, updateTableScrollHeight]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const period = viewPeriod;

      const [termsRes, structureRes, settingsRes] = await Promise.all([
        period ? api.get(`/terms?schoolPeriodId=${period.id}`) : Promise.resolve({ data: [] }),
        period ? api.get(`/academic/structure/${period.id}`) : Promise.resolve({ data: [] }),
        api.get('/settings')
      ]);

      if (period) {
        setTerms(termsRes.data.sort((a: Term, b: Term) => a.order - b.order));
        setStructure(structureRes.data.sort((a: PeriodGradeStructure, b: PeriodGradeStructure) =>
          (a.grade.order || 0) - (b.grade.order || 0)
        ));
      } else {
        setTerms([]);
        setStructure([]);
      }

      if (settingsRes.data.council_points_limit) {
        setPointsLimit(Number(settingsRes.data.council_points_limit));
      }
      if (settingsRes.data.council_points_per_subject_limit) {
        setPointsPerSubjectLimit(Number(settingsRes.data.council_points_per_subject_limit));
      }
      if (settingsRes.data.passing_grade != null) {
        setPassingGrade(Number(settingsRes.data.passing_grade));
      }
      if (settingsRes.data.max_grade != null) {
        setMaxGrade(Number(settingsRes.data.max_grade));
      }
    } catch (error) {
      console.error('Error fetching data', error);
      message.error('Error al cargar la información inicial');
    } finally {
      setLoading(false);
    }
  }, [viewPeriod]);

  useEffect(() => {
    // Reset selections when the view period changes
    setStep(0);
    setSelectedTerm(null);
    setSelectedSection(null);
    setStudentsData([]);
    setCouncilDone(false);
    setCouncilCompletedAt(null);
    setGuideTeacherName('');
    setClosedSections(null);
    setSelectedBulkSections(new Set());
    fetchData();
  }, [fetchData]);

  const fetchCouncilData = async (sectionId: number, termId: number, gradeId: number) => {
    setLoading(true);
    try {
      const [res, checklistRes, guideRes] = await Promise.all([
        api.get(`/council/data?sectionId=${sectionId}&termId=${termId}&gradeId=${gradeId}`),
        viewPeriod
          ? api.get(`/period-closure/${viewPeriod.id}/checklist?gradeId=${gradeId}&sectionId=${sectionId}&termId=${termId}`)
          : Promise.resolve({ data: null }),
        viewPeriod
          ? api.get(`/section-guides?schoolPeriodId=${viewPeriod.id}&gradeId=${gradeId}&sectionId=${sectionId}`)
          : Promise.resolve({ data: null })
      ]);
      setStudentsData((res.data as CouncilStudent[]).slice().sort((a, b) => compareStudents(
        { document: a.studentDni, documentType: a.documentType, lastName: a.studentName, firstName: '' },
        { document: b.studentDni, documentType: b.documentType, lastName: b.studentName, firstName: '' }
      )));
      setCouncilDone(checklistRes.data?.status === 'done');
      setCouncilCompletedAt(checklistRes.data?.completedAt ? new Date(checklistRes.data.completedAt) : null);
      const gt = guideRes.data?.guideTeacher;
      setGuideTeacherName(gt ? `${gt.lastName} ${gt.firstName}` : '');
      setStep(2);
    } catch (error) {
      console.error('Error fetching council data', error);
      message.error('Error al cargar los estudiantes');
    } finally {
      setLoading(false);
    }
  };

  const handlePointChange = (studentId: number, inscriptionSubjectId: number, value: number | null) => {
    const student = studentsData.find(s => s.id === studentId);
    if (!student) return;

    const newValue = value || 0;

    // Validate per-subject limit
    if (newValue > pointsPerSubjectLimit) {
      message.warning(`El límite de puntos por materia es de ${pointsPerSubjectLimit}.`);
      return;
    }

    // Validate total limit
    const currentTotal = student.subjects.reduce((sum, s) => {
      if (s.inscriptionSubjectId === inscriptionSubjectId) return sum;
      return sum + (s.points || 0);
    }, 0);

    if (currentTotal + newValue > pointsLimit) {
      message.warning(`El límite total de puntos por alumno es de ${pointsLimit}.`);
      return;
    }

    setStudentsData(prev => prev.map(sData => {
      if (sData.id === studentId) {
        return {
          ...sData,
          subjects: sData.subjects.map(s =>
            s.inscriptionSubjectId === inscriptionSubjectId ? { ...s, points: newValue } : s
          )
        };
      }
      return sData;
    }));
  };

  const handleSave = async () => {
    if (!selectedTerm) return;
    setSaving(true);
    try {
      const updates: any[] = [];
      studentsData.forEach(student => {
        student.subjects.forEach(subject => {
          updates.push({
            inscriptionSubjectId: subject.inscriptionSubjectId,
            termId: selectedTerm.id,
            points: subject.points
          });
        });
      });

      await api.post('/council/bulk-save', { updates });
      message.success('Puntos guardados correctamente');
    } catch (error) {
      console.error('Error saving points', error);
      message.error('Error al guardar los puntos');
    } finally {
      setSaving(false);
    }
  };

  const validateMissingPoints = (): CouncilStudent[] => {
    return studentsData.filter(student => {
      const hasFailingGrade = student.subjects.some(s => !isPassingGrade(s.grade || 0, passingGrade));
      const totalPoints = student.subjects.reduce((sum, s) => sum + (s.points || 0), 0);
      return hasFailingGrade && totalPoints === 0;
    });
  };

  const confirmMarkDone = async () => {
    if (!viewPeriod || !selectedTerm || !selectedSection) return;
    setMarkingDone(true);
    try {
      await api.post(`/period-closure/${viewPeriod.id}/checklist`, {
        gradeId: selectedSection.grade.id,
        sectionId: selectedSection.section.id,
        termId: selectedTerm.id,
        status: 'done'
      });
      setCouncilDone(true);
      setCouncilCompletedAt(new Date());
      message.success('Consejo de curso marcado como completado');
    } catch (error) {
      console.error('Error marking council as done', error);
      message.error('Error al marcar como completado');
    } finally {
      setMarkingDone(false);
    }
  };

  const handleMarkDone = async (checked: boolean) => {
    if (!viewPeriod || !selectedTerm || !selectedSection) return;

    if (!checked) {
      setMarkingDone(true);
      try {
        await api.post(`/period-closure/${viewPeriod.id}/checklist`, {
          gradeId: selectedSection.grade.id,
          sectionId: selectedSection.section.id,
          termId: selectedTerm.id,
          status: 'open'
        });
        setCouncilDone(false);
        setCouncilCompletedAt(null);
        message.success('Consejo de curso reabierto');
      } catch (error) {
        console.error('Error reopening council', error);
        message.error('Error al actualizar el estado del consejo');
      } finally {
        setMarkingDone(false);
      }
      return;
    }

    const missing = validateMissingPoints();
    if (missing.length > 0) {
      Modal.confirm({
        title: 'Estudiantes sin puntos asignados',
        content: `Hay ${missing.length} estudiante(s) con materias reprobadas que no tienen puntos de consejo. ¿Desea marcar el consejo como completado de todas formas?`,
        okText: 'Sí, marcar como completado',
        cancelText: 'No, revisar primero',
        okButtonProps: { danger: true },
        onOk: () => confirmMarkDone(),
      });
      return;
    }

    confirmMarkDone();
  };

  const handleBulkMarkAllDone = async () => {
    if (!viewPeriod || terms.length === 0 || structure.length === 0) return;

    const blockedTerms = terms.filter(t => t.isBlocked);
    if (blockedTerms.length === 0) {
      message.warning('No hay lapsos bloqueados. Debe bloquear los lapsos primero.');
      return;
    }

    const combinations: Array<{ gradeId: number; sectionId: number; termId: number }> = [];
    structure.forEach(pg => {
      pg.sections.forEach(sec => {
        if (sec.name.toLowerCase().includes('materia pendiente')) return;
        blockedTerms.forEach(term => {
          combinations.push({ gradeId: pg.grade.id, sectionId: sec.id, termId: term.id });
        });
      });
    });

    if (combinations.length === 0) {
      message.warning('No hay combinaciones de grado/sección para marcar.');
      return;
    }

    Modal.confirm({
      title: 'Marcar todos los consejos como completados',
      content: `Se marcarán ${combinations.length} consejos de curso (${blockedTerms.length} lapsos × grados/secciones) como completados. ¿Desea continuar?`,
      okText: 'Sí, marcar todos',
      cancelText: 'Cancelar',
      onOk: async () => {
        setBulkMarking(true);
        setBulkProgress({ done: 0, total: combinations.length });
        let successCount = 0;
        let failCount = 0;
        for (let i = 0; i < combinations.length; i++) {
          const { gradeId, sectionId, termId } = combinations[i];
          try {
            await api.post(`/period-closure/${viewPeriod.id}/checklist`, {
              gradeId, sectionId, termId, status: 'done'
            });
            successCount++;
          } catch {
            failCount++;
          }
          setBulkProgress({ done: i + 1, total: combinations.length });
        }
        setBulkMarking(false);
        if (failCount === 0) {
          message.success(`${successCount} consejos de curso marcados como completados`);
        } else {
          message.warning(`${successCount} marcados, ${failCount} fallaron`);
        }
      }
    });
  };

  // Bulk export: generate actas (preliminary or final) for all selected sections
  const handleBulkExportActas = async (isPreliminary: boolean) => {
    if (!selectedTerm || !viewPeriod) return;
    const combos: { grade: Grade; section: Section }[] = [];
    structure.forEach(pg => {
      pg.sections.forEach(sec => {
        const key = `${pg.grade.id}:${sec.id}`;
        if (selectedBulkSections.has(key)) combos.push({ grade: pg.grade, section: sec });
      });
    });
    if (combos.length === 0) {
      message.warning('Seleccione al menos una sección');
      return;
    }
    setBulkExporting(true);
    setBulkExportProgress({ done: 0, total: combos.length });
    let success = 0;
    let failed = 0;
    for (let i = 0; i < combos.length; i++) {
      const { grade, section } = combos[i];
      try {
        const [res, checklistRes, guideRes] = await Promise.all([
          api.get(`/council/data?sectionId=${section.id}&termId=${selectedTerm.id}&gradeId=${grade.id}`),
          api.get(`/period-closure/${viewPeriod.id}/checklist?gradeId=${grade.id}&sectionId=${section.id}&termId=${selectedTerm.id}`).catch(() => ({ data: null })),
          api.get(`/section-guides?schoolPeriodId=${viewPeriod.id}&gradeId=${grade.id}&sectionId=${section.id}`).catch(() => ({ data: null })),
        ]);
        const students = (res.data as CouncilStudent[]).slice().sort((a, b) => compareStudents(
          { document: a.studentDni, documentType: a.documentType, lastName: a.studentName, firstName: '' },
          { document: b.studentDni, documentType: b.documentType, lastName: b.studentName, firstName: '' }
        ));
        if (students.length === 0) { failed++; setBulkExportProgress({ done: i + 1, total: combos.length }); continue; }
        const { columnDefs, prevTerms } = computeCouncilColumns(students);
        const completedAt = checklistRes.data?.completedAt ? new Date(checklistRes.data.completedAt) : null;
        const gt = guideRes.data?.guideTeacher;
        const guideTeacher = gt ? `${gt.lastName} ${gt.firstName}` : '';
        const buffer = await buildCouncilWorkbook({
          students, columnDefs, prevTerms,
          term: selectedTerm, section: { section, grade },
          guideTeacher, completedAt,
          allTerms: terms,
          showPrevTerms: showPreviousTerms, showPrevCouncilPts: showPrevCouncilPoints,
          rounding: enableRounding, passingGrade, maxGrade,
          institutionName: settings.name, periodName: viewPeriod?.name || '',
          isPreliminary,
        });
        const gradeName = grade.name?.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]+/g, '_') || 'grado';
        const sectionName = section.name?.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]+/g, '_') || 'seccion';
        const prefix = isPreliminary ? 'consejo_curso_preliminar' : 'consejo_curso';
        saveAs(new Blob([buffer]), `${prefix}_${gradeName}_${sectionName}.xlsx`);
        success++;
      } catch (error: any) {
        console.error(`Error generando acta para ${grade.name} ${section.name}:`, error?.response?.data || error?.message || error);
        failed++;
      }
      setBulkExportProgress({ done: i + 1, total: combos.length });
      // Small delay to avoid browser blocking consecutive downloads
      if (i < combos.length - 1) await new Promise(r => setTimeout(r, 300));
    }
    setBulkExporting(false);
    if (success > 0 && failed === 0) {
      message.success(`Se generaron ${success} acta${success !== 1 ? 's' : ''} correctamente`);
    } else if (success > 0 && failed > 0) {
      message.warning(`Se generaron ${success} acta${success !== 1 ? 's' : ''}, ${failed} sin estudiantes o con errores`);
    } else if (failed > 0) {
      message.error(`No se pudieron generar las actas (${failed} error${failed !== 1 ? 'es' : ''}). Revise la consola para detalles.`);
    } else {
      message.error('No se pudieron generar las actas. Las secciones seleccionadas no tienen estudiantes.');
    }
  };

  const handleTermClick = async (term: Term) => {
    if (term.isBlocked) {
      // Term globally blocked → all sections are closed
      setClosedSections(null);
      setSelectedTerm(term);
      setStep(1);
      return;
    }

    // Term not globally blocked → check if any sections are individually closed
    try {
      const res = await api.get(`/terms/${term.id}/section-closures`);
      const { closedSections: closed } = res.data;
      if (!closed || closed.length === 0) {
        message.warning('El lapso debe estar cerrado para al menos una sección para realizar el consejo de curso.');
        return;
      }
      setClosedSections(closed);
      setSelectedTerm(term);
      setStep(1);
    } catch (error) {
      console.error('Error fetching section closures', error);
      message.error('Error al verificar el estado de cierre del lapso');
    }
  };

  const isSectionClosed = (sectionId: number, gradeId: number): boolean => {
    if (!selectedTerm) return false;
    if (selectedTerm.isBlocked) return true; // globally blocked
    if (closedSections === null) return true; // all closed
    return closedSections.some(c => c.sectionId === sectionId && c.gradeId === gradeId);
  };

  // True when the currently-selected section has its term closed (globally or per-section)
  const isSelectedSectionClosed = (): boolean => {
    if (!selectedSection) return false;
    return isSectionClosed(selectedSection.section.id, selectedSection.grade.id);
  };

  const renderTermSelector = () => (
    <div style={{ padding: '0px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }} className="animate-card">
        <Title level={2} style={{ margin: 0, fontWeight: 900, letterSpacing: '-0.04em' }}>Seleccione el Lapso</Title>
        <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>Identifique el periodo académico para el procesamiento de puntos</Text>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <Button
          type="primary"
          size="large"
          icon={<CheckCircleOutlined />}
          onClick={handleBulkMarkAllDone}
          loading={bulkMarking}
          disabled={isReadOnly || terms.length === 0 || structure.length === 0 || !terms.some(t => t.isBlocked)}
          style={{
            borderRadius: 14,
            fontWeight: 800,
            height: 38,
            padding: '0 24px',
            background: '#52c41a',
            border: 'none',
            boxShadow: '0 8px 20px rgba(82,196,77,0.25)'
          }}
        >
          {bulkMarking
            ? `Marcando... ${bulkProgress.done}/${bulkProgress.total}`
            : 'Marcar todos los consejos como completados'}
        </Button>
      </div>

      <Row gutter={[32, 32]} justify="center">
        {terms.map((term, idx) => (
          <Col key={term.id} xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              className={`premium-card animate-card delay-${(idx % 3) + 1}`}
              styles={{ body: { padding: '20px 16px' } }}
              style={{
                textAlign: 'center',
                transition: 'all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)',
                cursor: 'pointer',
                opacity: term.isBlocked ? 1 : 0.85
              }}
              onClick={() => handleTermClick(term)}
            >
              <div style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: term.isBlocked ? 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)' : 'linear-gradient(135deg, #faad14 0%, #d48806 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                boxShadow: term.isBlocked ? '0 8px 16px rgba(24,144,255,0.2)' : '0 8px 16px rgba(250,173,20,0.2)',
                transition: 'all 0.3s ease'
              }} className="icon-wrapper">
                <CalendarOutlined style={{ fontSize: 24, color: term.isBlocked ? '#fff' : '#bfbfbf' }} />
              </div>

              <Title level={4} style={{ margin: '0 0 4px 0', fontWeight: 800 }}>{term.name}</Title>

              <div style={{ marginTop: 8 }}>
                {term.isBlocked ? (
                  <Tag color="blue" style={{ borderRadius: 20, padding: '2px 16px', fontWeight: 700, border: 'none', textTransform: 'uppercase', fontSize: 10 }}>
                    Lapso cerrado · Consejo habilitado
                  </Tag>
                ) : (
                  <Tag color="warning" style={{ borderRadius: 20, padding: '2px 16px', fontWeight: 700, border: 'none', textTransform: 'uppercase', fontSize: 10 }}>
                    Cierre por sección disponible
                  </Tag>
                )}
              </div>

              <div style={{
                position: 'absolute',
                top: 20,
                right: 20,
                opacity: 0.1,
                fontSize: 40,
                fontWeight: 900,
                fontFamily: 'system-ui'
              }}>
                0{term.order || idx + 1}
              </div>
            </Card>
          </Col>
        ))}
        {terms.length === 0 && (
          <Col span={24}>
            <Empty description="No hay lapsos configurados para este período escolar" />
          </Col>
        )}
      </Row>
    </div>
  );

  const renderSectionSelector = () => {
    // Agrupar secciones por grado
    const sectionsByGrade: { grade: Grade, sections: Section[] }[] = [];
    structure.forEach(pg => {
      const matchFilter = !filterYear || pg.grade.name.toLowerCase().includes(filterYear.toLowerCase());
      if (matchFilter) {
        const sortedSections = [...pg.sections]
          .filter(s => !s.name.toLowerCase().includes('materia pendiente'))
          .sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          );
        if (sortedSections.length > 0) {
          sectionsByGrade.push({ grade: pg.grade, sections: sortedSections });
        }
      }
    });

    return (
      <div style={{ padding: '0px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Space size="middle" className="animate-card">
            <Button
              icon={<LeftOutlined />}
              onClick={() => setStep(0)}
              style={{
                borderRadius: '50%',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                border: 'none',
                background: '#fff'
              }}
            />
            <div>
              <Title level={2} style={{ margin: 0, fontWeight: 900, letterSpacing: '-0.03em' }}>Estructura Académica</Title>
              <Text type="secondary" style={{ fontWeight: 500 }}>Elija la sección para gestionar los puntos del consejo en el {selectedTerm?.name}</Text>
            </div>
          </Space>
          <Input
            prefix={<FilterOutlined style={{ color: '#1890ff' }} />}
            placeholder="Buscar por año o grado..."
            size="large"
            className="premium-search animate-card"
            style={{ width: 300, borderRadius: 12, height: 36, animationDelay: '0.1s' }}
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
          />
        </div>

        {/* Bulk acta export bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: '12px 16px', background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0' }} className="animate-card">
          <Space size="middle">
            <Checkbox
              checked={sectionsByGrade.length > 0 && sectionsByGrade.every(g => g.sections.every(s => selectedBulkSections.has(`${g.grade.id}:${s.id}`)))}
              indeterminate={selectedBulkSections.size > 0 && !(sectionsByGrade.length > 0 && sectionsByGrade.every(g => g.sections.every(s => selectedBulkSections.has(`${g.grade.id}:${s.id}`))))}
              onChange={e => {
                if (e.target.checked) {
                  const all = new Set<string>();
                  sectionsByGrade.forEach(g => g.sections.forEach(s => all.add(`${g.grade.id}:${s.id}`)));
                  setSelectedBulkSections(all);
                } else {
                  setSelectedBulkSections(new Set());
                }
              }}
              style={{ fontWeight: 700 }}
            >
              Seleccionar todas
            </Checkbox>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {selectedBulkSections.size} sección{selectedBulkSections.size !== 1 ? 'es' : ''} seleccionada{selectedBulkSections.size !== 1 ? 's' : ''}
            </Text>
          </Space>
          <Space size="middle">
            <Button
              type="default"
              size="large"
              icon={<FileExcelOutlined />}
              onClick={() => handleBulkExportActas(true)}
              loading={bulkExporting}
              disabled={selectedBulkSections.size === 0}
              style={{ borderRadius: 10, fontWeight: 800, height: 36, padding: '0 16px', color: '#595959', borderColor: '#d9d9d9' }}
            >
              {bulkExporting ? `Generando... ${bulkExportProgress.done}/${bulkExportProgress.total}` : 'Actas Preliminares'}
            </Button>
            <Button
              type="default"
              size="large"
              icon={<FileExcelOutlined />}
              onClick={() => handleBulkExportActas(false)}
              loading={bulkExporting}
              disabled={selectedBulkSections.size === 0}
              style={{ borderRadius: 10, fontWeight: 800, height: 36, padding: '0 16px', color: '#595959', borderColor: '#d9d9d9' }}
            >
              Actas Finales
            </Button>
          </Space>
        </div>

        {sectionsByGrade.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<Text type="secondary" strong>No se encontraron resultados para su búsqueda</Text>}
          />
        ) : (
          sectionsByGrade.map((group, groupIdx) => (
            <div
              key={group.grade.id}
              className="section-group animate-card"
              style={{
                marginBottom: 24,
                animationDelay: `${groupIdx * 0.1}s`
              }}
            >
              <div className="grade-header-premium">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: group.grade.isDiversified ? '#fa541c' : '#1890ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    boxShadow: group.grade.isDiversified ? '0 4px 8px rgba(250,84,28,0.15)' : '0 4px 8px rgba(24,144,255,0.15)'
                  }}>
                    <Title level={5} style={{ color: '#fff', margin: 0, fontWeight: 900 }}>{group.grade.order || '?'}</Title>
                  </div>
                  <div>
                    <Title level={4} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em', color: '#1f1f1f' }}>
                      {group.grade.name}
                    </Title>
                    <Text style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.5 }}>
                      {group.grade.isDiversified ? 'Ciclo Diversificado' : 'Educación Media General'}
                    </Text>
                  </div>
                </div>
              </div>

              <Row gutter={[24, 24]}>
                {group.sections.map((sec, secIdx) => {
                  const sectionClosed = isSectionClosed(sec.id, group.grade.id);
                  const selected = selectedBulkSections.has(`${group.grade.id}:${sec.id}`);
                  const accentColor = group.grade.isDiversified ? '#fa541c' : '#1890ff';
                  const accentColorDark = group.grade.isDiversified ? '#d4380d' : '#096dd9';
                  return (
                  <Col key={sec.id} xs={24} sm={12} md={8} lg={6}>
                    <Tooltip title={sectionClosed ? undefined : 'El lapso para esta sección no se ha cerrado'}>
                    <Card
                      hoverable={sectionClosed}
                      className="section-card-premium"
                      styles={{ body: { padding: 0 } }}
                      style={{
                        borderRadius: 14,
                        border: selected ? `2px solid ${accentColor}` : '1px solid rgba(0,0,0,0.05)',
                        animationDelay: `${(groupIdx * 0.1) + (secIdx * 0.05)}s`,
                        cursor: sectionClosed ? 'pointer' : 'not-allowed',
                        opacity: sectionClosed ? 1 : 0.5,
                        filter: sectionClosed ? 'none' : 'grayscale(0.6)',
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                      onClick={() => {
                        if (!sectionClosed) return;
                        setSelectedSection({ section: sec, grade: group.grade });
                        if (selectedTerm) fetchCouncilData(sec.id, selectedTerm.id, group.grade.id);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 72 }}>
                        {/* Main content (80%) */}
                        <div style={{ flex: 1, padding: '14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            className="section-letter-wrapper"
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 12,
                              background: group.grade.isDiversified ? '#fff2e8' : '#f0f5ff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 22,
                              fontWeight: 900,
                              color: group.grade.isDiversified ? '#fa541c' : '#1890ff',
                              flexShrink: 0,
                              transition: 'all 0.3s ease'
                            }}
                          >
                            {sec.name.replace(/sección/gi, '').trim().charAt(0)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: 16, color: '#1f1f1f', lineHeight: 1.2, marginBottom: 2 }}>
                              Sección {sec.name.replace(/sección/gi, '').trim()}
                            </div>
                            <Space size={4}>
                              <Tag color={group.grade.isDiversified ? 'volcano' : 'blue'} style={{ border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, margin: 0 }}>
                                {viewPeriod?.name}
                              </Tag>
                              {sectionClosed ? (
                                <Tag color="success" style={{ border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, margin: 0 }}>
                                  Lapso cerrado
                                </Tag>
                              ) : (
                                <Tag color="warning" style={{ border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, margin: 0 }}>
                                  Lapso abierto
                                </Tag>
                              )}
                            </Space>
                          </div>
                        </div>
                        {/* Selection strip (20%) — acts as toggle */}
                        {sectionClosed && (
                          <div
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedBulkSections(prev => {
                                const next = new Set(prev);
                                const key = `${group.grade.id}:${sec.id}`;
                                if (next.has(key)) next.delete(key); else next.add(key);
                                return next;
                              });
                            }}
                            style={{
                              width: '22%',
                              minWidth: 48,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4,
                              cursor: 'pointer',
                              background: selected
                                ? `linear-gradient(180deg, ${accentColor} 0%, ${accentColorDark} 100%)`
                                : '#f5f5f5',
                              transition: 'all 0.25s ease',
                              borderLeft: selected ? 'none' : '1px solid #e8e8e8',
                            }}
                          >
                            {selected ? (
                              <>
                                <CheckCircleOutlined style={{ fontSize: 20, color: '#fff' }} />
                                <Text style={{ fontSize: 9, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>Sel.</Text>
                              </>
                            ) : (
                              <>
                                <CheckCircleOutlined style={{ fontSize: 20, color: '#bfbfbf' }} />
                                <Text style={{ fontSize: 9, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5 }}>Sel.</Text>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                    </Tooltip>
                  </Col>
                  );
                })}
              </Row>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderDataTable = () => {
    if (studentsData.length === 0) return (
      <div style={{ padding: '80px 0', textAlign: 'center' }}>
        <Empty
          description={
            <div style={{ marginTop: 16 }}>
              <Title level={4}>No se encontraron estudiantes</Title>
              <Text type="secondary">Esta sección no cuenta con alumnos inscritos para procesar.</Text>
            </div>
          }
        />
        <Button icon={<LeftOutlined />} onClick={() => setStep(1)} style={{ marginTop: 24 }}>Volver a Secciones</Button>
      </div>
    );

    const missingPoints = validateMissingPoints();

    // Generate dynamic columns based on subjects or subject groups
    const columnDefinitions: { title: string, key: string, groupId?: number, subjectId?: number }[] = [];
    const seenGroups = new Set<number>();
    const seenSubjects = new Set<number>();

    // Collect all unique subjects/groups across ALL students to ensure we don't miss any
    studentsData.forEach(student => {
      student.subjects.forEach(sub => {
        if (sub.groupId && sub.groupName) {
          if (!seenGroups.has(sub.groupId)) {
            columnDefinitions.push({
              title: sub.groupName,
              key: `group-${sub.groupId}`,
              groupId: sub.groupId
            });
            seenGroups.add(sub.groupId);
          }
        } else {
          if (!seenSubjects.has(sub.id)) {
            columnDefinitions.push({
              title: sub.name,
              key: `subject-${sub.id}`,
              subjectId: sub.id
            });
            seenSubjects.add(sub.id);
          }
        }
      });
    });

    // Collect previous term names from the first student's first subject
    const prevTermNames: { termId: number, termName: string }[] = [];
    if (studentsData.length > 0 && studentsData[0].subjects.length > 0) {
      const firstSubPrevTerms = studentsData[0].subjects[0].previousTermsData || [];
      firstSubPrevTerms.forEach(pt => prevTermNames.push({ termId: pt.termId, termName: pt.termName }));
    }

    const handleExportExcel = async (isPreliminary = false) => {
      if (studentsData.length === 0) return;
      if (isPreliminary) setExportingPreliminary(true); else setExportingExcel(true);
      try {
        const buffer = await buildCouncilWorkbook({
          students: studentsData,
          columnDefs: columnDefinitions,
          prevTerms: prevTermNames,
          term: selectedTerm!,
          section: selectedSection!,
          guideTeacher: guideTeacherName,
          completedAt: councilCompletedAt,
          allTerms: terms,
          showPrevTerms: showPreviousTerms,
          showPrevCouncilPts: showPrevCouncilPoints,
          rounding: enableRounding,
          passingGrade,
          maxGrade,
          institutionName: settings.name,
          periodName: viewPeriod?.name || '',
          isPreliminary,
        });
        const gradeName = selectedSection?.grade.name?.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]+/g, '_') || 'grado';
        const sectionName = selectedSection?.section.name?.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]+/g, '_') || 'seccion';
        const fileNamePrefix = isPreliminary ? 'consejo_curso_preliminar' : 'consejo_curso';
        saveAs(new Blob([buffer]), `${fileNamePrefix}_${gradeName}_${sectionName}.xlsx`);
        message.success('Reporte de consejo de curso generado correctamente');
      } catch (error) {
        console.error('Error generando reporte de consejo de curso:', error);
        message.error('No se pudo generar el reporte de consejo de curso');
      } finally {
        setExportingExcel(false);
        setExportingPreliminary(false);
      }
    };

    const columns = [
      {
        title: '#',
        key: 'rowIndex',
        width: 50,
        fixed: 'left' as const,
        align: 'center' as const,
        render: (_: any, __: CouncilStudent, index: number) => (
          <Text style={{ fontWeight: 700, fontSize: 12, color: '#8c8c8c' }}>{index + 1}</Text>
        )
      },
      {
        title: 'Estudiante',
        dataIndex: 'studentName',
        key: 'studentName',
        fixed: 'left' as const,
        width: 250,
        render: (text: string, record: CouncilStudent) => {
          const usedPoints = record.subjects.reduce((sum, s) => sum + (s.points || 0), 0);

          let docTypeLetter = '';
          switch (record.documentType) {
            case 'Venezolano': docTypeLetter = 'V'; break;
            case 'Extranjero': docTypeLetter = 'E'; break;
            case 'Pasaporte': docTypeLetter = 'P'; break;
            case 'Cedula Escolar': docTypeLetter = 'CE'; break;
            default: docTypeLetter = '';
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Space direction="vertical" size={0}>
                <Space>
                  <UserOutlined style={{ color: '#1890ff', fontSize: 13 }} />
                  <Text style={{ fontWeight: 700, fontSize: 14, color: '#262626' }}>{text}</Text>
                </Space>
                <div style={{ paddingLeft: 20 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <strong>{docTypeLetter}</strong>-{record.studentDni}
                  </Text>
                </div>
              </Space>
              <div style={{ paddingLeft: 20 }}>
                <Tag
                  color={usedPoints >= pointsLimit ? 'volcano' : 'blue'}
                  style={{ fontWeight: 700, border: 'none', borderRadius: 4, height: 20, lineHeight: '18px', fontSize: 10, textTransform: 'uppercase' }}
                >
                  TOTAL: {usedPoints} / {pointsLimit} · MÁX/MATERIA: {pointsPerSubjectLimit}
                </Tag>
              </div>
            </div>
          );
        }
      },
      {
        title: 'PROM.',
        key: 'average',
        width: 100,
        fixed: 'left' as const,
        align: 'center' as const,
        render: (_: any, record: CouncilStudent) => {
          const avgSubjects = record.subjects.filter(s => s.includeInAverage !== false);
          const totalGrades = avgSubjects.reduce((sum, s) => {
            const finalGrade = Math.max(1, roundGrade((s.grade || 0) + (s.points || 0)));
            return sum + finalGrade;
          }, 0);
          const average = avgSubjects.length > 0 ? Number((totalGrades / avgSubjects.length).toFixed(2)) : 0;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: !isPassingGrade(average, passingGrade) ? '#fff1f0' : '#f0f5ff', padding: '4px', borderRadius: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: 900, color: !isPassingGrade(average, passingGrade) ? '#cf1322' : '#096dd9' }}>
                {average.toFixed(2)}
              </Text>
              <Text style={{ fontSize: 9, fontWeight: 800, color: !isPassingGrade(average, passingGrade) ? '#cf1322' : '#096dd9', textTransform: 'uppercase' }}>Final</Text>
            </div>
          );
        }
      },
      ...columnDefinitions.map(colDef => {
        // Build children: one subcolumn per previous term + current term columns
        const children: any[] = [];

        // Previous term subcolumns (only if showPreviousTerms is enabled)
        if (showPreviousTerms) {
          prevTermNames.forEach((ptn, ptnIdx) => {
          children.push({
            title: (
              <div style={{ fontSize: 9, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase' }}>
                {ptn.termName}
              </div>
            ),
            key: `${colDef.key}-prev-${ptn.termId}`,
            width: 55,
            align: 'center' as const,
            onCell: ptnIdx === 0 ? () => ({ style: { borderLeft: '3px solid #d9d9d9' } }) : undefined,
            onHeaderCell: ptnIdx === 0 ? () => ({ style: { borderLeft: '3px solid #d9d9d9' } }) : undefined,
            render: (_: any, record: CouncilStudent) => {
              const subjectData = colDef.groupId
                ? record.subjects.find(s => s.groupId === colDef.groupId)
                : record.subjects.find(s => s.id === colDef.subjectId);

              if (!subjectData) return <Text type="secondary">-</Text>;

              const pt = (subjectData.previousTermsData || []).find(p => p.termId === ptn.termId);
              if (!pt) return <Text type="secondary">-</Text>;

              return (
                <Tooltip
                  title={
                    <div style={{ padding: 4 }}>
                      <div style={{ marginBottom: 4, fontWeight: 700 }}>{pt.termName}</div>
                      <div>Nota base: <strong>{formatGrade(pt.baseGrade, enableRounding)}</strong></div>
                      <div>Puntos de consejo: <strong>+{pt.councilPoints}</strong></div>
                      <div>Nota final: <strong>{formatGrade(pt.finalGrade, enableRounding)}</strong></div>
                    </div>
                  }
                >
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '2px 0',
                  }}>
                    <Text style={{ fontSize: 9, fontWeight: 700, color: pt.councilPoints > 0 ? '#fa8c16' : '#bfbfbf', lineHeight: '11px' }}>
                      +{pt.councilPoints}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: 800, color: !isPassingGrade(pt.finalGrade, passingGrade) ? '#cf1322' : '#389e0d' }}>
                      {formatGrade(pt.finalGrade, enableRounding)}
                    </Text>
                  </div>
                </Tooltip>
              );
            }
          });
        });
        }

        // Current term subcolumns: Base (named as current term), Pts, Final
        children.push(
          {
            title: <div style={{ fontSize: 9, fontWeight: 700, color: '#1890ff', textTransform: 'uppercase' }}>{selectedTerm?.name}</div>,
            key: `${colDef.key}-base`,
            width: 55,
            align: 'center' as const,
            onCell: (prevTermNames.length === 0 || !showPreviousTerms) ? () => ({ style: { borderLeft: '3px solid #d9d9d9' } }) : undefined,
            onHeaderCell: (prevTermNames.length === 0 || !showPreviousTerms) ? () => ({ style: { borderLeft: '3px solid #d9d9d9' } }) : undefined,
            render: (_: any, record: CouncilStudent) => {
              const subjectData = colDef.groupId
                ? record.subjects.find(s => s.groupId === colDef.groupId)
                : record.subjects.find(s => s.id === colDef.subjectId);
              if (!subjectData) return <Text type="secondary">-</Text>;
              const baseGrade = subjectData.grade || 0;
              return (
                <Tooltip title="Nota Base del lapso actual">
                  <Text style={{ fontSize: 14, color: !isPassingGrade(baseGrade, passingGrade) ? '#cf1322' : '#262626', fontWeight: 600 }}>
                    {formatGrade(baseGrade, enableRounding)}
                  </Text>
                </Tooltip>
              );
            }
          },
          {
            title: <div style={{ fontSize: 9, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase' }}>Pts</div>,
            key: `${colDef.key}-pts`,
            width: 50,
            align: 'center' as const,
            className: 'council-points-column',
            render: (_: any, record: CouncilStudent) => {
              const subjectData = colDef.groupId
                ? record.subjects.find(s => s.groupId === colDef.groupId)
                : record.subjects.find(s => s.id === colDef.subjectId);
              if (!subjectData) return <Text type="secondary">-</Text>;
              return (
                <Input
                  value={subjectData.points}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (isNaN(val)) {
                      handlePointChange(record.id, subjectData.inscriptionSubjectId, 0);
                    } else {
                      handlePointChange(record.id, subjectData.inscriptionSubjectId, Math.min(Math.max(val, 0), pointsPerSubjectLimit));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) return;
                    e.preventDefault();
                    const target = e.target as HTMLInputElement;
                    const currentTd = target.closest('td');
                    const currentTr = currentTd?.closest('tr');
                    if (!currentTd || !currentTr) return;
                    const tds = Array.from(currentTr.querySelectorAll('td'));
                    const colIndex = tds.indexOf(currentTd);
                    const focusInput = (td: Element | null | undefined) => {
                      const input = td?.querySelector('input');
                      if (input) { input.focus(); input.select(); }
                    };
                    if (e.key === 'ArrowDown' || e.key === 'Enter') {
                      const nextTr = currentTr.nextElementSibling as HTMLTableRowElement | null;
                      if (nextTr) focusInput(nextTr.querySelectorAll('td')[colIndex]);
                    } else if (e.key === 'ArrowUp') {
                      const prevTr = currentTr.previousElementSibling as HTMLTableRowElement | null;
                      if (prevTr) focusInput(prevTr.querySelectorAll('td')[colIndex]);
                    } else if (e.key === 'ArrowRight') {
                      for (let i = colIndex + 1; i < tds.length; i++) {
                        if (tds[i].querySelector('input')) { focusInput(tds[i]); break; }
                      }
                    } else if (e.key === 'ArrowLeft') {
                      for (let i = colIndex - 1; i >= 0; i--) {
                        if (tds[i].querySelector('input')) { focusInput(tds[i]); break; }
                      }
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  disabled={isReadOnly || !isSelectedSectionClosed() || councilDone}
                  className="premium-input-number"
                  style={{ width: 42, fontWeight: 700, borderRadius: 6, textAlign: 'center', padding: '0 2px' }}
                />
              );
            }
          },
          {
            title: <div style={{ fontSize: 9, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase' }}>Final</div>,
            key: `${colDef.key}-final`,
            width: 48,
            align: 'center' as const,
            render: (_: any, record: CouncilStudent) => {
              const subjectData = colDef.groupId
                ? record.subjects.find(s => s.groupId === colDef.groupId)
                : record.subjects.find(s => s.id === colDef.subjectId);
              if (!subjectData) return <Text type="secondary">-</Text>;
              const baseGrade = subjectData.grade || 0;
              const currentPoints = subjectData.points || 0;
              const totalGrade = roundGrade((baseGrade + currentPoints) * 100) / 100;
              return (
                <Tooltip title="Nota Final del lapso">
                  <div style={{
                    width: 34,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: !isPassingGrade(totalGrade, passingGrade) ? '#fff1f0' : '#f6ffed',
                    borderRadius: 5,
                    border: `1px solid ${!isPassingGrade(totalGrade, passingGrade) ? '#ffa39e' : '#b7eb8f'}`
                  }}>
                    <Text style={{ fontSize: 13, fontWeight: 800, color: !isPassingGrade(totalGrade, passingGrade) ? '#cf1322' : '#389e0d' }}>
                      {formatGrade(totalGrade, enableRounding)}
                    </Text>
                  </div>
                </Tooltip>
              );
            }
          }
        );

        return {
          title: (
            <Tooltip title={colDef.title}>
              <div style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
                fontSize: 12,
                fontWeight: 800,
                textTransform: 'uppercase',
                color: '#595959',
                textAlign: 'center',
                lineHeight: '1.2',
              }}>
                {colDef.title}
              </div>
            </Tooltip>
          ),
          key: colDef.key,
          align: 'center' as const,
          width: children.reduce((sum, c) => sum + (c.width || 0), 0),
          onHeaderCell: () => ({ style: { borderLeft: '3px solid #d9d9d9' } }),
          children,
        };
      })
    ];

    const tableWidth = columns.reduce((sum, column) => sum + (column.width || 0), 0);

    return (
      <div style={{ padding: '0px 0' }} className="animate-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space size="middle">
            <Button
              icon={<LeftOutlined />}
              onClick={() => setStep(1)}
              style={{ borderRadius: 10, height: 34, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
            />
            <div>
              <Title level={3} style={{ margin: 0, fontWeight: 900, letterSpacing: '-0.03em' }}>
                {selectedSection?.grade.name} <span style={{ color: '#bfbfbf', fontWeight: 400 }}>/</span> Sección {selectedSection?.section.name.replace(/sección/gi, '').trim()}
              </Title>
              <Space split={<Text type="secondary" style={{ opacity: 0.5 }}>•</Text>}>
                <Text type="secondary" style={{ fontWeight: 600 }}>{selectedTerm?.name}</Text>
                <Tag color="processing" style={{ border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{viewPeriod?.name}</Tag>
              </Space>
            </div>
          </Space>
          <Space size="large" align="center">
            {prevTermNames.length > 0 && (
              <Checkbox
                checked={showPreviousTerms}
                onChange={(e) => setShowPreviousTerms(e.target.checked)}
                style={{ fontWeight: 600 }}
              >
                Mostrar lapsos anteriores
              </Checkbox>
            )}
            {prevTermNames.length > 0 && showPreviousTerms && (
              <Checkbox
                checked={showPrevCouncilPoints}
                onChange={(e) => setShowPrevCouncilPoints(e.target.checked)}
                style={{ fontWeight: 600 }}
              >
                Incluir puntos de consejos anteriores
              </Checkbox>
            )}
            {!isSelectedSectionClosed() && (
              <Alert
                message="Lapso activo"
                description="Debe cerrar el lapso para esta sección para modificar puntos del consejo."
                type="warning"
                showIcon
                style={{ borderRadius: 14, padding: '4px 16px' }}
              />
            )}
            <Button
              type="default"
              size="large"
              icon={<FileExcelOutlined />}
              onClick={() => handleExportExcel(true)}
              loading={exportingPreliminary}
              disabled={studentsData.length === 0}
              style={{
                borderRadius: 10,
                fontWeight: 800,
                height: 36,
                padding: '0 16px',
                color: '#595959',
                borderColor: '#d9d9d9'
              }}
            >
              Acta Preliminar
            </Button>
            <Button
              type="default"
              size="large"
              icon={<FileExcelOutlined />}
              onClick={() => handleExportExcel(false)}
              loading={exportingExcel}
              disabled={studentsData.length === 0}
              style={{
                borderRadius: 10,
                fontWeight: 800,
                height: 36,
                padding: '0 16px',
                color: '#217346',
                borderColor: '#b7d7c0'
              }}
            >
              Acta Final
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
              disabled={isReadOnly || !isSelectedSectionClosed() || councilDone}
              style={{
                borderRadius: 10,
                fontWeight: 800,
                height: 36,
                padding: '0 20px',
                background: '#001529',
                border: 'none',
                boxShadow: '0 8px 20px rgba(0,21,41,0.2)'
              }}
            >
              Guardar Calificaciones
            </Button>
            <Checkbox
              checked={councilDone}
              onChange={(e) => handleMarkDone(e.target.checked)}
              disabled={isReadOnly || markingDone || !isSelectedSectionClosed()}
              style={{
                fontWeight: 800,
                fontSize: 13,
                padding: '6px 14px',
                borderRadius: 10,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                background: councilDone ? '#f6ffed' : '#fff',
                border: `2px solid ${councilDone ? '#52c41a' : '#d9d9d9'}`,
                transition: 'all 0.3s ease',
              }}
            >
              {councilDone ? (
                <span style={{ color: '#389e0d', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircleOutlined /> Consejo completado
                </span>
              ) : (
                'Marcar como completado'
              )}
            </Checkbox>
          </Space>
        </div>

        {missingPoints.length > 0 && !councilDone && (
          <Alert
            message={`${missingPoints.length} estudiante(s) con materias reprobadas sin puntos de consejo`}
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            style={{ marginBottom: 16, borderRadius: 14 }}
            action={
              <Button
                size="small"
                type="primary"
                ghost
                onClick={() => {
                  setMissingPointsStudents(missingPoints);
                  setShowMissingModal(true);
                }}
              >
                Ver estudiantes
              </Button>
            }
          />
        )}

        {councilDone && (
          <Alert
            message="Consejo de curso completado"
            description="Este consejo de curso ha sido marcado como completado. Puede desmarcarlo si necesita realizar cambios."
            type="success"
            showIcon
            style={{ marginBottom: 16, borderRadius: 14 }}
          />
        )}

        <Card
          ref={tableCardRef}
          className="premium-table-card"
          styles={{ body: { padding: 0 } }}
          style={{ width: '100%', minWidth: 0, borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)' }}
        >
          <style>{`
            .council-table-premium .ant-table-thead > tr > th {
              background-color: #fafafa !important;
              color: #595959 !important;
              font-weight: 800 !important;
              text-transform: uppercase;
              font-size: 11px;
              letter-spacing: 0.5px;
              padding: 8px 6px !important;
              border-bottom: 2px solid #f0f0f0 !important;
            }
            .council-table-premium .ant-table-row {
              transition: all 0.2s ease;
            }
            .council-table-premium .row-odd {
              background-color: #ffffff;
            }
            .council-table-premium .row-even {
              background-color: #fafbfc;
            }
            .council-table-premium .ant-table-row:hover > td:not(.ant-table-cell-fix) {
              background-color: #f0f7ff !important;
            }
            .council-table-premium .ant-table-cell {
              padding: 6px 8px !important;
              border-bottom: 1px solid #f0f0f0 !important;
            }
            .premium-input-number:hover, .premium-input-number-focused {
              border-color: #1890ff !important;
              box-shadow: 0 0 0 2px rgba(24,144,255,0.1) !important;
            }
            .council-table-premium .council-points-column {
              padding-left: 2px !important;
              padding-right: 2px !important;
            }
            /* Fixed columns: opaque background + z-index so scrollable cells
               behind stay hidden when row is hovered/zebra.
               Ant Design v6 uses .ant-table-cell-fix as the base class. */
            .council-table-premium .ant-table-tbody tr.row-odd > .ant-table-cell-fix {
              z-index: 3 !important;
              background-color: #ffffff !important;
            }
            .council-table-premium .ant-table-tbody tr.row-even > .ant-table-cell-fix {
              z-index: 3 !important;
              background-color: #fafbfc !important;
            }
            .council-table-premium .ant-table-tbody tr.ant-table-row:hover > .ant-table-cell-fix {
              z-index: 3 !important;
              background-color: #f0f7ff !important;
            }
            .council-table-premium .ant-table-thead .ant-table-cell-fix {
              z-index: 5 !important;
              background-color: #fafafa !important;
            }
          `}</style>
          <Table
            dataSource={studentsData}
            columns={columns}
            rowKey="id"
            pagination={false}
            scroll={{ x: tableWidth + 1, y: tableScrollHeight }}
            size="middle"
            bordered
            className="council-table-premium"
            rowClassName={(_, index) => index % 2 === 0 ? 'row-odd' : 'row-even'}
          />
        </Card>
      </div>
    );
  };

  if (loading && step < 2) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: 20 }}>
        <Spin size="large" />
        <Text type="secondary" style={{ textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 11, fontWeight: 800 }}>Preparando Mesa de Trabajo...</Text>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minWidth: 0, padding: '0 24px' }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-card {
          animation: fadeUp 0.6s cubic-bezier(0.23, 1, 0.32, 1) both;
        }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }
        
        .premium-card {
          border-radius: 24px !important;
          border: 1px solid rgba(0,0,0,0.05) !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.03) !important;
        }
        .premium-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 48px rgba(0,0,0,0.08) !important;
          border-color: #1890ff !important;
        }
        .premium-card:hover .icon-wrapper {
          transform: scale(1.1) rotate(-5deg);
        }
        
        .grade-header-premium {
          position: sticky;
          top: 0;
          z-index: 10;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(12px);
          padding: 16px 0;
          margin-bottom: 32px;
          border-bottom: 2px solid #f0f0f0;
        }
        
        .section-card-premium {
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
        }
        .section-card-premium:hover {
          transform: translateY(-6px);
          box-shadow: 0 12px 28px rgba(0,0,0,0.08) !important;
          border-color: transparent !important;
          background: #fff !important;
        }
        .section-card-premium:hover .section-letter-wrapper {
          transform: scale(1.1) rotate(-8deg);
          box-shadow: 0 8px 20px rgba(0,0,0,0.1);
        }
      `}</style>

      <Breadcrumb
        style={{ marginBottom: 32 }}
        className="animate-card"
        items={[
          { title: <Text style={{ fontWeight: 600, fontSize: 12, color: '#8c8c8c', cursor: 'pointer' }} onClick={() => window.location.href = '/control-estudios'}>CONTROL DE ESTUDIOS</Text> },
          { title: <Text style={{ fontWeight: 800, fontSize: 12, color: '#262626', cursor: 'pointer' }} onClick={() => { setStep(0); setSelectedTerm(null); setSelectedSection(null); }}>CONSEJOS DE CURSO</Text> },
          ...(step >= 1 ? [{ title: <Tag color="blue" style={{ borderRadius: 6, fontWeight: 700, margin: 0, cursor: 'pointer' }} onClick={() => setStep(0)}>{selectedTerm?.name}</Tag> }] : []),
          ...(step >= 2 ? [{ title: <Tag color="gold" style={{ borderRadius: 6, fontWeight: 700, margin: 0, cursor: 'pointer' }} onClick={() => setStep(1)}>{selectedSection?.grade.name} {selectedSection?.section.name.replace(/sección/gi, '').trim()}</Tag> }] : []),
        ]}
      />

      {step === 0 && renderTermSelector()}
      {step === 1 && renderSectionSelector()}
      {step === 2 && renderDataTable()}

      <Modal
        title="Estudiantes sin puntos de consejo"
        open={showMissingModal}
        onCancel={() => setShowMissingModal(false)}
        footer={<Button onClick={() => setShowMissingModal(false)}>Cerrar</Button>}
        width={600}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Los siguientes estudiantes tienen materias reprobadas pero no se les han asignado puntos de consejo de curso:
        </Text>
        <Table
          dataSource={missingPointsStudents}
          columns={[
            { title: 'Estudiante', dataIndex: 'studentName', key: 'studentName' },
            {
              title: 'Cédula',
              key: 'studentDni',
              render: (_: unknown, record: CouncilStudent) => {
                let prefix = '';
                switch (record.documentType) {
                  case 'Venezolano': prefix = 'V'; break;
                  case 'Extranjero': prefix = 'E'; break;
                  case 'Pasaporte': prefix = 'P'; break;
                  case 'Cedula Escolar': prefix = 'CE'; break;
                }
                return `${prefix}-${record.studentDni}`;
              }
            },
            {
              title: 'Materias reprobadas',
              key: 'failingSubjects',
              render: (_: unknown, record: CouncilStudent) => {
                const failing = record.subjects.filter(s => !isPassingGrade(s.grade || 0, passingGrade));
                return (
                  <Space wrap>
                    {failing.map(s => (
                      <Tag key={s.id} color="red">{s.name}: {formatGrade(s.grade, enableRounding)}</Tag>
                    ))}
                  </Space>
                );
              }
            },
          ]}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Modal>
    </div>
  );
};

export default CourseCouncil;
