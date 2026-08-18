/**
 * Visual identity (icon + color) for subjects.
 *
 * Precedence:
 *   1. Explicit override stored on the Subject record (`icon` / `color` columns)
 *   2. Keyword match against the subject name
 *   3. Deterministic fallback derived from the name, so the same subject always
 *      gets the same icon/color even without configuration.
 */

import {
  BookOutlined,
  ReadOutlined,
  GlobalOutlined,
  TrophyOutlined,
  ExperimentOutlined,
  CompassOutlined,
  HighlightOutlined,
  FontSizeOutlined,
  CalculatorOutlined,
  BgColorsOutlined,
  HeartOutlined,
  ToolOutlined,
  DesktopOutlined,
  TeamOutlined,
  BankOutlined,
  FlagOutlined,
  BulbOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  SoundOutlined,
  MedicineBoxOutlined,
  ThunderboltOutlined,
  RocketOutlined,
  SafetyOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import type React from 'react';

const normalize = (s?: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Icons offered in the catalog picker, keyed by the value persisted in `subjects.icon`. */
export const SUBJECT_ICONS: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
  BookOutlined,
  ReadOutlined,
  GlobalOutlined,
  TrophyOutlined,
  ExperimentOutlined,
  CompassOutlined,
  HighlightOutlined,
  FontSizeOutlined,
  CalculatorOutlined,
  BgColorsOutlined,
  HeartOutlined,
  ToolOutlined,
  DesktopOutlined,
  TeamOutlined,
  BankOutlined,
  FlagOutlined,
  BulbOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  SoundOutlined,
  MedicineBoxOutlined,
  ThunderboltOutlined,
  RocketOutlined,
  SafetyOutlined,
  LineChartOutlined,
};

/** Human-readable labels for the icon picker. */
export const SUBJECT_ICON_LABELS: Record<string, string> = {
  BookOutlined: 'Libro',
  ReadOutlined: 'Lectura',
  GlobalOutlined: 'Globo / Idiomas',
  TrophyOutlined: 'Trofeo / Deportes',
  ExperimentOutlined: 'Laboratorio',
  CompassOutlined: 'Brújula / Orientación',
  HighlightOutlined: 'Lápiz / Dibujo',
  FontSizeOutlined: 'Tipografía / Redacción',
  CalculatorOutlined: 'Calculadora / Matemática',
  BgColorsOutlined: 'Paleta / Arte',
  HeartOutlined: 'Corazón / Salud',
  ToolOutlined: 'Herramienta / Técnica',
  DesktopOutlined: 'Computadora / Informática',
  TeamOutlined: 'Equipo / Convivencia',
  BankOutlined: 'Institución / Historia',
  FlagOutlined: 'Bandera / Patria',
  BulbOutlined: 'Bombillo / Ideas',
  FileTextOutlined: 'Documento',
  AppstoreOutlined: 'Bloques / General',
  SoundOutlined: 'Sonido / Música',
  MedicineBoxOutlined: 'Botiquín / Biología',
  ThunderboltOutlined: 'Rayo / Física',
  RocketOutlined: 'Cohete / Proyectos',
  SafetyOutlined: 'Escudo / Premilitar',
  LineChartOutlined: 'Gráfico / Estadística',
};

/** Curated palette. Ordered so the hash fallback spreads colors nicely. */
export const SUBJECT_COLORS = [
  '#2563eb', // blue
  '#16a34a', // green
  '#9333ea', // purple
  '#ea580c', // orange
  '#0d9488', // teal
  '#db2777', // pink
  '#d97706', // amber
  '#4f46e5', // indigo
  '#0891b2', // cyan
  '#dc2626', // red
];

/**
 * Keyword rules, evaluated in order. The first whose keyword appears in the
 * normalized subject name wins, so more specific rules must come first.
 */
const KEYWORD_RULES: { keywords: string[]; icon: string; color: string }[] = [
  { keywords: ['orientacion y convivencia', 'convivencia'], icon: 'CompassOutlined', color: '#1d4ed8' },
  { keywords: ['redaccion', 'ortografia'], icon: 'FontSizeOutlined', color: '#d97706' },
  { keywords: ['artes graficas', 'grafica'], icon: 'HighlightOutlined', color: '#db2777' },
  { keywords: ['arte', 'patrimonio', 'plastica'], icon: 'BgColorsOutlined', color: '#9f1239' },
  { keywords: ['educacion fisica', 'deporte'], icon: 'TrophyOutlined', color: '#ea580c' },
  { keywords: ['ingles', 'lengua extranjera', 'idioma'], icon: 'GlobalOutlined', color: '#16a34a' },
  { keywords: ['matematica', 'algebra', 'trigonometria', 'calculo'], icon: 'CalculatorOutlined', color: '#9333ea' },
  { keywords: ['castellano', 'literatura', 'lengua'], icon: 'ReadOutlined', color: '#2563eb' },
  { keywords: ['ciencias naturales', 'naturaleza'], icon: 'ExperimentOutlined', color: '#0d9488' },
  { keywords: ['biologia'], icon: 'MedicineBoxOutlined', color: '#16a34a' },
  { keywords: ['quimica'], icon: 'ExperimentOutlined', color: '#0891b2' },
  { keywords: ['fisica'], icon: 'ThunderboltOutlined', color: '#4f46e5' },
  { keywords: ['geografia', 'historia', 'ciudadania', 'soberania'], icon: 'GlobalOutlined', color: '#2563eb' },
  { keywords: ['informatica', 'computacion', 'tecnologia'], icon: 'DesktopOutlined', color: '#4f46e5' },
  { keywords: ['premilitar', 'defensa'], icon: 'SafetyOutlined', color: '#dc2626' },
  { keywords: ['musica', 'canto'], icon: 'SoundOutlined', color: '#db2777' },
  { keywords: ['salud', 'higiene'], icon: 'HeartOutlined', color: '#dc2626' },
  { keywords: ['estadistica', 'contabilidad'], icon: 'LineChartOutlined', color: '#0891b2' },
  { keywords: ['proyecto', 'emprendimiento'], icon: 'RocketOutlined', color: '#ea580c' },
  { keywords: ['tecnica', 'taller', 'dibujo tecnico'], icon: 'ToolOutlined', color: '#d97706' },
  { keywords: ['grupo', 'agrupacion', 'participacion'], icon: 'TeamOutlined', color: '#0d9488' },
];

export interface SubjectVisual {
  Icon: React.ComponentType<{ style?: React.CSSProperties }>;
  color: string;
  iconName: string;
}

interface SubjectLike {
  name?: string | null;
  icon?: string | null;
  color?: string | null;
}

/** Stable non-negative hash so the fallback is deterministic per subject name. */
const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const FALLBACK_ICONS = ['BookOutlined', 'AppstoreOutlined', 'BulbOutlined', 'FileTextOutlined'];

/** Resolves the icon component and color to use for a subject. */
export function getSubjectVisual(subject: SubjectLike): SubjectVisual {
  const name = normalize(subject.name || '');

  const rule = KEYWORD_RULES.find(r => r.keywords.some(k => name.includes(k)));

  // Explicit overrides win over the keyword map and the hash fallback.
  const iconName =
    (subject.icon && SUBJECT_ICONS[subject.icon] ? subject.icon : null) ??
    rule?.icon ??
    FALLBACK_ICONS[hashString(name) % FALLBACK_ICONS.length];

  const color =
    subject.color ||
    rule?.color ||
    SUBJECT_COLORS[hashString(name) % SUBJECT_COLORS.length];

  return { Icon: SUBJECT_ICONS[iconName] ?? BookOutlined, color, iconName };
}

/** Converts a hex color to `rgba()` so it can be used as a soft background. */
export function withAlpha(hex: string, alpha: number): string {
  const clean = (hex || '').replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
