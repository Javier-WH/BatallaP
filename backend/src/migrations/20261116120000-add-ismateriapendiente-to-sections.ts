import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const secDesc: any = await queryInterface.describeTable('sections');
    if (!secDesc.isMateriaPendiente) {
      await queryInterface.addColumn('sections', 'isMateriaPendiente', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    // Backfill: mark the existing auxiliary "Materia Pendiente" section(s).
    // Section names are stored uppercase by the model hooks.
    await queryInterface.sequelize.query(
      `UPDATE sections SET isMateriaPendiente = 1 WHERE UPPER(TRIM(name)) = 'MATERIA PENDIENTE'`
    );
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const secDesc: any = await queryInterface.describeTable('sections');
    if (secDesc.isMateriaPendiente) {
      await queryInterface.removeColumn('sections', 'isMateriaPendiente');
    }
  },
};
