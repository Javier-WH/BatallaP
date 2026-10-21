import { QueryInterface, DataTypes } from 'sequelize';

// Enrollment plans can be "optional" (autoApply = false): they never become the
// plan in force by themselves and are only used when assigned to a student
// (inscriptions.enrollmentPlanId). NULL enrollmentPlanId = the plan in force.
export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const plans = await queryInterface.describeTable('enrollment_plans');
    if (!plans.autoApply) {
      await queryInterface.addColumn('enrollment_plans', 'autoApply', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true });
    }
    const inscriptions = await queryInterface.describeTable('inscriptions');
    if (!inscriptions.enrollmentPlanId) {
      await queryInterface.addColumn('inscriptions', 'enrollmentPlanId', {
        type: DataTypes.INTEGER, allowNull: true,
        references: { model: 'enrollment_plans', key: 'id' }, onDelete: 'SET NULL',
      });
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn('inscriptions', 'enrollmentPlanId');
    await queryInterface.removeColumn('enrollment_plans', 'autoApply');
  },
};
