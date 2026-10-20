/**
 * fakeGuardian — detects placeholder guardian profiles.
 *
 * The imported production data links students with no real representative to
 * dummy profiles ("PLACEHOLDER CAPTAIN"), some of which point to hundreds of
 * students. They must never surface as an actual representative — and their
 * "also represents" list would flood any UI that renders sibling links.
 *
 * A profile is fake when:
 *   - its name contains a marker word (FAKE_GUARDIAN_WORDS — case- and
 *     accent-insensitive), or
 *   - its document has at most one digit ("7", "8", blank) — no real cédula
 *     or passport is that short.
 *
 * Extend FAKE_GUARDIAN_WORDS if production data uses other marker words.
 */
const FAKE_GUARDIAN_WORDS = [
  'placeholder',
  'sin representante',
  'sin tutor',
  'no aplica',
  'no registra',
  'no registrado',
  'desconocido',
  'n/a',
];

const COMBINING_MARKS = /[\u0300-\u036f]/g;

/** True when the guardian profile is a placeholder, not a real person. */
export function isFakeGuardian(
  profile: { firstName?: string | null; lastName?: string | null; document?: string | null } | null | undefined,
): boolean {
  if (!profile) return true;
  const digits = (profile.document ?? '').replace(/\D/g, '');
  if (digits.length <= 1) return true;
  const name = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '');
  return FAKE_GUARDIAN_WORDS.some(w => name.includes(w));
}
