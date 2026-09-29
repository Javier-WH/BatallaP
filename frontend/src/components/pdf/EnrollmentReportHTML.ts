import type { SnapshotData } from '@/services/enrollmentReportService';

export interface EnrollmentReportHTMLProps {
  data: SnapshotData;
  uuid: string;
  createdAt: string;
  logoBase64?: string | null;
}

const escapeHtml = (s: string): string =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const escolaridadLabels: Record<string, string> = {
  regular: 'Regular',
  repitiente: 'Repitiente',
  materia_pendiente: 'Materia Pendiente',
};

const relationshipLabels: Record<string, string> = {
  mother: 'Madre',
  father: 'Padre',
  sibling: 'Hermano(a)',
  grandparent: 'Abuelo(a)',
  uncle_aunt: 'Tío(a)',
  representative: 'Otro',
};

// Same convention as final summary sheets: cédulas escolares show the bare
// number (not an official document); other types keep their letter prefix.
const formatDocument = (type: string | undefined, doc: string | undefined): string => {
  if (!doc) return '';
  if (type === 'Cedula Escolar') return doc;
  const prefix = type === 'Venezolano' ? 'V' : type === 'Extranjero' ? 'E' : type === 'Pasaporte' ? 'P' : 'CE';
  return `${prefix}-${doc}`;
};

const row = (label: string, value: string | undefined | null, index: number): string =>
  `<tr${index % 2 === 1 ? ' class="alt"' : ''}><td class="lbl">${escapeHtml(label)}</td><td class="val">${escapeHtml(value || '—')}</td></tr>`;

const buildSheet = ({ data, uuid, createdAt, logoBase64 }: EnrollmentReportHTMLProps): string => {
  const { institution, period, grade, student, representative } = data;

  const genderLabel = student.gender === 'M' ? 'Masculino' : 'Femenino';
  const birthPlace = [student.birthParish, student.birthMunicipality, student.birthState]
    .filter(Boolean)
    .join(', ');

  const studentRows = [
    row('Nombres', student.firstName, 0),
    row('Apellidos', student.lastName, 1),
    row('Documento', formatDocument(student.documentType, student.document), 2),
    row('Género', genderLabel, 3),
    row('Fecha de Nac.', student.birthdate, 4),
    row('Lugar de Nac.', birthPlace, 5),
    row('Dirección', student.address, 6),
    ...(student.pathology ? [row('Patología', student.pathology, 7)] : []),
  ].join('\n');

  const rep = representative?.data;
  const repRows = [
    row('Nombres', rep?.firstName, 0),
    row('Apellidos', rep?.lastName, 1),
    row('Documento', formatDocument(rep?.documentType, rep?.document), 2),
    row('Fecha de Nac.', rep?.birthdate, 3),
    row('Parentesco', representative ? (relationshipLabels[representative.relationship] || representative.relationship) : undefined, 4),
    row('Dirección', rep?.address, 5),
    row('Teléfono', rep?.phone, 6),
    row('Ocupación', rep?.occupation, 7),
  ].join('\n');

  const socioRows = data.enrollmentAnswers
    .map((qa, i) => row(qa.prompt, Array.isArray(qa.answer) ? qa.answer.join(', ') : qa.answer, i))
    .join('\n');

  const documentChecks = data.documents
    ? [
        { label: 'Partida de Nacimiento', checked: data.documents.receivedPartidaNacimiento },
        { label: 'Certificado de Aprendizaje', checked: data.documents.receivedCertificadoAprendizaje },
        { label: 'Carta de Buena Conducta', checked: data.documents.receivedCartaBuenaConducta },
        { label: 'Notas Certificadas', checked: data.documents.receivedNotasCertificadas },
        { label: 'Copia Cédula Estudiante', checked: data.documents.receivedCopiaCedulaEstudiante },
        { label: 'Copia Cédula Representante', checked: data.documents.receivedCopiaCedulaRepresentante },
        { label: 'Informes Médicos', checked: data.documents.receivedInformesMedicos },
        { label: 'Foto Carnet Estudiante', checked: data.documents.receivedFotoCarnetEstudiante },
      ]
    : [];

  const checkItem = (item: { label: string; checked: boolean }): string =>
    `<div class="chk"><span class="box${item.checked ? ' on' : ''}">${item.checked ? '✓' : '&nbsp;'}</span><span class="chk-lbl">${escapeHtml(item.label)}</span></div>`;

  const checkColA = documentChecks.slice(0, 4).map(checkItem).join('\n');
  const checkColB = documentChecks.slice(4).map(checkItem).join('\n');

  const generatedAt = new Date(createdAt).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return `
  <div class="sheet"><div class="sheet-inner">
    <div class="hdr">
      ${logoBase64 ? `<img src="${logoBase64}" class="logo" alt="logo" />` : ''}
      <div class="hdr-center">
        <div class="inst">${escapeHtml(institution.name || '')}</div>
        ${institution.deaCode ? `<div class="sub">Código DEA: ${escapeHtml(institution.deaCode)}</div>` : ''}
        <div class="sub">República Bolivariana de Venezuela</div>
      </div>
      ${logoBase64 ? '<div style="width:56px"></div>' : ''}
    </div>

    <div class="titlebar">PLANILLA DE INSCRIPCIÓN</div>

    <div class="badges">
      <div class="badge"><span class="bl">Período:</span><span class="bv">${escapeHtml(period.name)}</span></div>
      <div class="badge"><span class="bl">Grado:</span><span class="bv">${escapeHtml(grade.name)}</span></div>
      <div class="badge"><span class="bl">Condición:</span><span class="bv">${escapeHtml(escolaridadLabels[data.escolaridad] || data.escolaridad)}</span></div>
    </div>

    <div class="cols">
      <div class="col">
        <div class="sec"><h2>Datos del Estudiante</h2></div>
        <table class="rows">${studentRows}</table>
      </div>
      <div class="col">
        <div class="sec"><h2>Datos del Representante</h2></div>
        <table class="rows">${repRows}</table>
      </div>
    </div>

    ${socioRows ? `
    <div class="sec"><h2>Información Socio-Educativa</h2></div>
    <table class="rows">${socioRows}</table>
    ` : ''}

    ${documentChecks.length > 0 ? `
    <div class="sec"><h2>Documentos Consignados</h2></div>
    <div class="cols">
      <div class="col">${checkColA}</div>
      <div class="col">${checkColB}</div>
    </div>
    ` : ''}

    <div class="sig-area">
      <div class="sig"><div class="line"></div><div class="sig-lbl">Firma del Representante</div></div>
      <div class="sig"><div class="line"></div><div class="sig-lbl">Firma del Emisor y Sello</div></div>
    </div>

    <div class="ftr"><div class="ftr-line">
      <span>ID: ${escapeHtml(uuid)}</span>
      <span>Generado: ${escapeHtml(generatedAt)}</span>
    </div></div>
  </div></div>`;
};

// The document carries two identical half-letter (11 x 4.25in) pages so the
// print dialog's "Pages per sheet: 2" + Landscape stacks them one above the
// other on a single letter sheet. To print two DIFFERENT reports on one sheet,
// print page 1 of the first, re-feed the paper, then print page 2 of the next
// (page 2 lands on the bottom slot, keeping both copies upright).
export const generateEnrollmentReportHTML = (props: EnrollmentReportHTMLProps): string => {
  const sheet = buildSheet(props);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Planilla de Inscripción</title>
<style>
  *{ box-sizing:border-box; margin:0; padding:0; }

  html, body{
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body{
    background:#E4E1DA;
    font-family:Helvetica, Arial, sans-serif;
    color:#1a1a1a;
    font-size:9pt;
    padding:16px 0;
  }

  .page{
    max-width:11in;
    margin:0 auto;
    display:flex;
    flex-direction:column;
    gap:14px;
  }

  .sheet{
    background:#fff;
    box-shadow:0 6px 20px rgba(0,0,0,0.15);
    display:flex;
    flex-direction:column;
    min-height:100mm;
  }

  .sheet-inner{
    flex:1;
    display:flex;
    flex-direction:column;
    padding:7mm 9mm;
  }

  .hdr{
    display:flex;
    align-items:center;
    border-bottom:2px solid #1a3a5c;
    padding-bottom:5px;
    margin-bottom:5px;
  }
  .hdr .logo{ width:44px; height:44px; margin-right:12px; object-fit:contain; }
  .hdr-center{ flex:1; text-align:center; }
  .inst{ font-size:12pt; font-weight:bold; text-transform:uppercase; color:#1a3a5c; }
  .sub{ font-size:8pt; color:#555; margin-top:2px; }

  .titlebar{
    background:#1a3a5c;
    color:#fff;
    padding:4px 12px;
    margin:3px 0 6px;
    text-align:center;
    font-size:11pt;
    font-weight:bold;
    letter-spacing:1.5px;
  }

  .badges{ display:flex; justify-content:center; gap:16px; margin-bottom:5px; }
  .badge{
    display:flex; align-items:center;
    background:#f0f4f8; border:1px solid #d0d8e0; border-radius:4px;
    padding:4px 10px;
  }
  .badge .bl{ font-size:7pt; color:#666; font-weight:bold; text-transform:uppercase; margin-right:4px; }
  .badge .bv{ font-size:9pt; font-weight:bold; color:#1a3a5c; }

  .cols{ display:flex; gap:12px; }
  .col{ flex:1; }

  .sec{
    display:flex; align-items:center;
    margin-top:5px; margin-bottom:3px;
    border-bottom:1px solid #ccc; padding-bottom:2px;
  }
  .sec h2{ font-size:10pt; font-weight:bold; color:#1a3a5c; text-transform:uppercase; }

  table.rows{ width:100%; border-collapse:collapse; margin-bottom:6px; }
  table.rows tr.alt td{ background:#f8fafb; }
  table.rows td{ padding:2px 5px; border-bottom:0.5px solid #e0e0e0; vertical-align:middle; }
  td.lbl{ width:35%; font-size:8pt; font-weight:bold; color:#555; text-transform:uppercase; }
  td.val{ font-size:9pt; }

  .chk{ display:flex; align-items:center; margin-bottom:2px; padding-left:4px; }
  .box{
    width:10px; height:10px; flex-shrink:0;
    border:1px solid #999; margin-right:6px;
    text-align:center; font-size:7pt; line-height:10px; color:#fff;
  }
  .box.on{ background:#1a3a5c; border-color:#1a3a5c; }
  .chk-lbl{ font-size:8pt; }

  .sig-area{ margin-top:14px; display:flex; justify-content:space-around; }
  .sig{ width:180px; text-align:center; }
  .sig .line{ border-top:1px solid #333; margin-bottom:4px; }
  .sig-lbl{ font-size:8pt; color:#555; font-weight:bold; }

  .ftr{ margin-top:auto; padding-top:6px; }
  .ftr-line{
    border-top:1px solid #ccc; padding-top:4px;
    display:flex; justify-content:space-between;
    font-size:7pt; color:#999;
  }

  @media print{
    /* The document page IS half a landscape letter sheet (11 x 4.25 in), so
       the print dialog's "Pages per sheet: 2" + Landscape stacks one planilla
       above the other with no rescaling. Declaring @page size hides the
       Layout option — not needed since the page is landscape by definition. */
    @page{ size:11in 4.25in; margin:4mm 7mm; }

    body{ background:#fff; padding:0; }

    .page{
      max-width:none; margin:0; gap:2mm;
      page-break-after:always; break-after:page;
    }
    .page:last-child{ page-break-after:auto; break-after:auto; }

    .sheet{
      box-shadow:none; width:100%; margin:0;
      /* SLOT_MM below must match this height. */
      height:100mm;
      overflow:hidden;
      page-break-inside:avoid; break-inside:avoid;
    }
  }
</style>
</head>
<body>
<div class="page">
${sheet}
</div>
<div class="page">
${sheet}
</div>
<script>
(function () {
  // Same approach as BoletinHTML: if the content is taller than the print
  // slot, scale .sheet-inner down so nothing is clipped. The slot height is
  // hardcoded here (SLOT_MM) and must match @media print .sheet { height }.
  var SLOT_MM = 100;
  var SLOT_PX = SLOT_MM * 96 / 25.4;

  function fitSheets(isPrint) {
    document.querySelectorAll('.sheet').forEach(function (sheet) {
      var inner = sheet.querySelector('.sheet-inner');
      if (!inner) return;
      inner.style.transform = '';
      inner.style.width = '';
      if (!isPrint) return;
      var naturalHeight = inner.scrollHeight;
      if (naturalHeight > SLOT_PX) {
        var scale = SLOT_PX / naturalHeight;
        inner.style.transformOrigin = 'top left';
        inner.style.transform = 'scale(' + scale + ')';
        inner.style.width = (100 / scale) + '%';
      }
    });
  }

  window.addEventListener('beforeprint', function () { fitSheets(true); });
  window.addEventListener('afterprint', function () { fitSheets(false); });

  if (window.matchMedia) {
    var mq = window.matchMedia('print');
    var handler = function (e) { fitSheets(e.matches); };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
  }
})();
</script>
</body>
</html>`;
};
