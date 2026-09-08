/**
 * Formatea una fecha como tiempo relativo en español.
 * - < 1 minuto → "justo ahora"
 * - < 60 minutos → "hace X minutos"
 * - < 5 horas → "hace X horas"
 * - >= 5 horas → fecha formateada (ej: "8 sep 2026, 14:30")
 */
export function formatRelativeTime(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;

  // Si la fecha es del futuro (reloj desincronizado), mostrar "justo ahora"
  if (diffMs < 0) return 'justo ahora';

  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMs < 60000) return 'justo ahora';
  if (diffMin < 60) return `hace ${diffMin} minuto${diffMin === 1 ? '' : 's'}`;
  if (diffHours < 5) return `hace ${diffHours} hora${diffHours === 1 ? '' : 's'}`;

  return new Date(date).toLocaleString('es-VE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
