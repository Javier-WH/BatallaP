import { QueryInterface, DataTypes } from 'sequelize';

// Sellable items get an optional list of sizes; each delivery records the size
// handed over; item_inventory_movements is the audited stock ledger per
// item/size (stock = movements − delivered units of that size).
export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const items = await queryInterface.describeTable('sellable_items');
    if (!items.sizes) {
      await queryInterface.addColumn('sellable_items', 'sizes', { type: DataTypes.JSON, allowNull: true });
    }

    const deliveries = await queryInterface.describeTable('charge_deliveries');
    if (!deliveries.size) {
      await queryInterface.addColumn('charge_deliveries', 'size', { type: DataTypes.STRING(30), allowNull: true });
    }

    const tables = await queryInterface.showAllTables();
    if (!tables.includes('item_inventory_movements')) {
      await queryInterface.createTable('item_inventory_movements', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        sellableItemId: {
          type: DataTypes.INTEGER, allowNull: false,
          references: { model: 'sellable_items', key: 'id' }, onDelete: 'CASCADE',
        },
        size: { type: DataTypes.STRING(30), allowNull: true },
        quantity: { type: DataTypes.INTEGER, allowNull: false },
        type: { type: DataTypes.ENUM('ingreso', 'ajuste'), allowNull: false },
        note: { type: DataTypes.STRING(500), allowNull: true },
        createdByPersonId: {
          type: DataTypes.INTEGER, allowNull: true,
          references: { model: 'people', key: 'id' }, onDelete: 'SET NULL',
        },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      await queryInterface.addIndex('item_inventory_movements', ['sellableItemId']);
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('item_inventory_movements');
    await queryInterface.removeColumn('charge_deliveries', 'size');
    await queryInterface.removeColumn('sellable_items', 'sizes');
  },
};
