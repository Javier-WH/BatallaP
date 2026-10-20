import { QueryInterface, DataTypes } from 'sequelize';

// Sellable items get a configurable badge icon (a Lucide name or an uploaded
// image); item charges get a unit quantity so deliveries can be tracked per
// unit. charge_deliveries records each hand-over event: how many units, who
// delivered them and when.
export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const items = await queryInterface.describeTable('sellable_items');
    if (!items.icon) {
      await queryInterface.addColumn('sellable_items', 'icon', {
        type: DataTypes.STRING(60), allowNull: true,
      });
    }
    if (!items.iconImage) {
      await queryInterface.addColumn('sellable_items', 'iconImage', {
        type: DataTypes.STRING(255), allowNull: true,
      });
    }

    const charges = await queryInterface.describeTable('charges');
    if (!charges.quantity) {
      await queryInterface.addColumn('charges', 'quantity', {
        type: DataTypes.INTEGER, allowNull: false, defaultValue: 1,
      });
    }

    const tables = await queryInterface.showAllTables();
    if (!tables.includes('charge_deliveries')) {
      await queryInterface.createTable('charge_deliveries', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        chargeId: {
          type: DataTypes.INTEGER, allowNull: false,
          references: { model: 'charges', key: 'id' }, onDelete: 'CASCADE',
        },
        quantity: { type: DataTypes.INTEGER, allowNull: false },
        note: { type: DataTypes.STRING(500), allowNull: true },
        deliveredByPersonId: {
          type: DataTypes.INTEGER, allowNull: true,
          references: { model: 'people', key: 'id' }, onDelete: 'SET NULL',
        },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      await queryInterface.addIndex('charge_deliveries', ['chargeId']);
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('charge_deliveries');
    await queryInterface.removeColumn('charges', 'quantity');
    await queryInterface.removeColumn('sellable_items', 'iconImage');
    await queryInterface.removeColumn('sellable_items', 'icon');
  },
};
