import { QueryInterface, DataTypes, QueryTypes } from 'sequelize';

const STATUSES = ['preinscripcion', 'activo', 'historico', 'externo'];

export async function up(queryInterface: QueryInterface) {
  const sequelize = queryInterface.sequelize;

  await queryInterface.addColumn('school_periods', 'status', {
    type: DataTypes.ENUM(...STATUSES),
    allowNull: false,
    defaultValue: 'historico',
  });

  // Backfill from the legacy boolean flags
  await sequelize.query(`UPDATE school_periods SET status = 'externo' WHERE isExternal = 1`);
  await sequelize.query(
    `UPDATE school_periods SET status = 'activo' WHERE isActive = 1 AND isExternal = 0`
  );

  // The non-external period right after the active one becomes the preinscription period
  const rows = await sequelize.query<{ id: number }>(
    `SELECT next.id AS id
       FROM school_periods AS next
       JOIN school_periods AS current ON current.status = 'activo'
      WHERE next.isExternal = 0
        AND next.startYear = current.startYear + 1
      LIMIT 1`,
    { type: QueryTypes.SELECT }
  );

  if (rows.length > 0) {
    await sequelize.query(
      `UPDATE school_periods SET status = 'preinscripcion' WHERE id = ${Number(rows[0].id)}`
    );
  }

  await queryInterface.addIndex('school_periods', ['status']);

  await queryInterface.removeColumn('school_periods', 'isActive');
  await queryInterface.removeColumn('school_periods', 'isExternal');
}

export async function down(queryInterface: QueryInterface) {
  const sequelize = queryInterface.sequelize;

  await queryInterface.addColumn('school_periods', 'isActive', {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  });

  await queryInterface.addColumn('school_periods', 'isExternal', {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });

  await sequelize.query(`UPDATE school_periods SET isActive = 1 WHERE status = 'activo'`);
  await sequelize.query(`UPDATE school_periods SET isExternal = 1 WHERE status = 'externo'`);

  await queryInterface.removeIndex('school_periods', ['status']);
  await queryInterface.removeColumn('school_periods', 'status');
}
