import { QueryInterface, DataTypes } from 'sequelize';

const DEFAULT_REASONS = [
  'Hermanos',
  'Beca deportiva',
  'Hijo de personal',
  'Otro',
];

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const tables = (await queryInterface.showAllTables()).map((t: any) => (typeof t === 'string' ? t : t.tableName));

    if (!tables.includes('discount_reasons')) {
      await queryInterface.createTable('discount_reasons', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
        description: { type: DataTypes.TEXT, allowNull: true },
        active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      await queryInterface.addIndex('discount_reasons', ['active']);
      const now = new Date();
      await queryInterface.bulkInsert(
        'discount_reasons',
        DEFAULT_REASONS.map(name => ({ name, description: null, active: true, createdAt: now, updatedAt: now }))
      );
    }

    if (!tables.includes('inscription_discounts')) {
      await queryInterface.createTable('inscription_discounts', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        inscriptionId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: 'inscriptions', key: 'id' },
          onDelete: 'CASCADE',
        },
        reasonId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: 'discount_reasons', key: 'id' },
        },
        kind: { type: DataTypes.ENUM('percent', 'fixed'), allowNull: false },
        value: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
        appliesTo: { type: DataTypes.ENUM('mensualidad', 'matricula', 'todo'), allowNull: false, defaultValue: 'todo' },
        fromMonth: { type: DataTypes.STRING(3), allowNull: true },
        toMonth: { type: DataTypes.STRING(3), allowNull: true },
        note: { type: DataTypes.TEXT, allowNull: true },
        active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        createdByPersonId: { type: DataTypes.INTEGER, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
      await queryInterface.addIndex('inscription_discounts', ['inscriptionId']);
      await queryInterface.addIndex('inscription_discounts', ['reasonId']);
      await queryInterface.addIndex('inscription_discounts', ['active']);
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('inscription_discounts');
    await queryInterface.dropTable('discount_reasons');
  },
};
