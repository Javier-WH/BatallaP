import { QueryInterface } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    // Drop the old unique index (scheduleId, day, period_id) that prevented multiple group subjects per cell
    try {
      await queryInterface.removeIndex('schedule_entries', 'schedule_entries_schedule_id_day_period_id_unique');
    } catch (e) {
      // Index may have a different name — try the generic name
      try {
        await queryInterface.removeIndex('schedule_entries', 'scheduleId_day_period_id');
      } catch (e2) {
        console.log('[migration] Old index not found, skipping drop');
      }
    }
    // Add new unique index that allows multiple group subjects but prevents duplicate (subject in same slot)
    try {
      await queryInterface.addIndex('schedule_entries', ['scheduleId', 'day', 'period_id', 'subjectId'], {
        unique: true,
        name: 'schedule_entries_schedule_id_day_period_id_subject_id_unique',
      });
    } catch (e) {
      console.log('[migration] New index may already exist:', (e as Error).message);
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    try {
      await queryInterface.removeIndex('schedule_entries', 'schedule_entries_schedule_id_day_period_id_subject_id_unique');
    } catch (e) {
      console.log('[migration] New index not found, skipping drop');
    }
    try {
      await queryInterface.addIndex('schedule_entries', ['scheduleId', 'day', 'period_id'], {
        unique: true,
        name: 'schedule_entries_schedule_id_day_period_id_unique',
      });
    } catch (e) {
      console.log('[migration] Old index may already exist:', (e as Error).message);
    }
  },
};
