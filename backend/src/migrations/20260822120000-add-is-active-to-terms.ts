import { QueryInterface, DataTypes, QueryTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  const sequelize = queryInterface.sequelize;

  await queryInterface.addColumn('terms', 'isActive', {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });

  // Backfill: mark the first term (by order) of the active school period as active
  const activePeriods = await sequelize.query<{ id: number }>(
    `SELECT id FROM school_periods WHERE status = 'activo' LIMIT 1`,
    { type: QueryTypes.SELECT }
  );

  if (activePeriods.length > 0) {
    const periodId = activePeriods[0].id;
    const firstTerm = await sequelize.query<{ id: number }>(
      `SELECT id FROM terms WHERE schoolPeriodId = ${periodId} ORDER BY \`order\` ASC LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    if (firstTerm.length > 0) {
      await sequelize.query(
        `UPDATE terms SET isActive = 1 WHERE id = ${firstTerm[0].id}`
      );
    }
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn('terms', 'isActive');
}
