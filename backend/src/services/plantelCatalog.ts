import fs from 'fs';
import path from 'path';

export type PlantelRecord = {
  code?: string | null;
  name: string;
  state?: string | null;
  municipality?: string | null;
  parish?: string | null;
  dependency?: string | null;
};

let cachedPlanteles: PlantelRecord[] | null = null;

const loadPlanteles = (): PlantelRecord[] => {
  if (cachedPlanteles) {
    return cachedPlanteles;
  }
  const filePath = path.resolve(process.cwd(), 'src/assets/planteles.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  cachedPlanteles = JSON.parse(raw) as PlantelRecord[];
  return cachedPlanteles;
};

const normalize = (value?: string | null) =>
  value ? value.trim().toLowerCase() : null;

export const searchPlanteles = (params: {
  q?: string | null;
  state?: string | null;
  municipality?: string | null;
  limit?: number;
}): PlantelRecord[] => {
  const { q, state, municipality, limit } = params;
  const target = loadPlanteles();
  const normalizedQuery = normalize(q ?? undefined);
  const normalizedState = normalize(state ?? undefined);
  const normalizedMunicipality = normalize(municipality ?? undefined);
  const limitNumber =
    typeof limit === 'number' && Number.isFinite(limit) && limit > 0
      ? Math.min(limit, 200)
      : 50;

  const filtered = target.filter((plantel) => {
    if (normalizedState && normalize(plantel.state) !== normalizedState) {
      return false;
    }
    if (
      normalizedMunicipality &&
      normalize(plantel.municipality) !== normalizedMunicipality
    ) {
      return false;
    }
    if (normalizedQuery) {
      const combined = [
        plantel.name,
        plantel.code,
        plantel.state,
        plantel.municipality,
        plantel.parish,
        plantel.dependency
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return combined.includes(normalizedQuery);
    }
    return true;
  });

  return filtered.slice(0, limitNumber);
};

export const findPlantelByCode = (code: string): PlantelRecord | undefined => {
  const normalizedCode = normalize(code);
  if (!normalizedCode) return undefined;
  return loadPlanteles().find(
    (plantel) =>
      normalize(plantel.code) === normalizedCode ||
      normalize(plantel.name) === normalizedCode
  );
};

export const getAllPlanteles = (): PlantelRecord[] => loadPlanteles();
