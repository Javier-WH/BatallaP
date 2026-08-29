import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    // Change allowConsecutiveBlocks from BOOLEAN to INTEGER (0/1/2)
    const subjDesc: any = await queryInterface.describeTable('subjects');
    if (subjDesc.allowConsecutiveBlocks) {
      // In MySQL, changing from BOOLEAN (TINYINT) to INTEGER is straightforward.
      // Existing true values become 1, false become 0.
      await queryInterface.changeColumn('subjects', 'allowConsecutiveBlocks', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const subjDesc: any = await queryInterface.describeTable('subjects');
    if (subjDesc.allowConsecutiveBlocks) {
      await queryInterface.changeColumn('subjects', 'allowConsecutiveBlocks', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },
};
