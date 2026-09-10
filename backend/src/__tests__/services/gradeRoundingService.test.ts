import { GradeRoundingService } from '@/services/gradeRoundingService';
import { createTestSetting } from '../helpers/testData';
import { Setting } from '@/models/index';

describe('GradeRoundingService — isRoundingEnabled', () => {
  it('retorna true cuando el setting es "true"', async () => {
    await createTestSetting('enable_grade_rounding', 'true');
    const result = await GradeRoundingService.isRoundingEnabled();
    expect(result).toBe(true);
  });

  it('retorna false cuando el setting es "false"', async () => {
    await createTestSetting('enable_grade_rounding', 'false');
    const result = await GradeRoundingService.isRoundingEnabled();
    expect(result).toBe(false);
  });

  it('retorna false (default) cuando el setting no existe', async () => {
    // No setting created
    const result = await GradeRoundingService.isRoundingEnabled();
    expect(result).toBe(false);
  });

  it('retorna false cuando el setting tiene un valor distinto de "true"', async () => {
    await createTestSetting('enable_grade_rounding', 'yes');
    const result = await GradeRoundingService.isRoundingEnabled();
    expect(result).toBe(false);
  });
});
