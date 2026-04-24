import { Setting } from '@/models/index';

/**
 * Service for grade rounding configuration.
 * The backend always returns exact values from the database.
 * The frontend is responsible for applying rounding visually based on this setting.
 */
export class GradeRoundingService {
  /**
   * Check if grade rounding is enabled in the system settings.
   * @returns Promise<boolean> - true if rounding is enabled, false otherwise
   */
  static async isRoundingEnabled(): Promise<boolean> {
    try {
      const setting = await Setting.findOne({
        where: { key: 'enable_grade_rounding' }
      });

      if (!setting) {
        // Default to false if setting doesn't exist
        return false;
      }

      return setting.value === 'true';
    } catch (error) {
      console.error('[GradeRoundingService] Error checking rounding setting:', error);
      // Default to false on error
      return false;
    }
  }
}

export default GradeRoundingService;
