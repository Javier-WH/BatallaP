import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  // charges table
  await queryInterface.createTable('charges', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    inscriptionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'inscriptions', key: 'id' },
      onDelete: 'CASCADE',
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'school_periods', key: 'id' },
    },
    feeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'fees', key: 'id' },
    },
    sellableItemId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'sellable_items', key: 'id' },
    },
    type: {
      type: DataTypes.ENUM('mensualidad', 'matricula', 'gastos_administrativos', 'item', 'otro'),
      allowNull: false,
    },
    month: { type: DataTypes.STRING(10), allowNull: true },
    description: { type: DataTypes.STRING(200), allowNull: false },
    amount: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
    currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'USD' },
    amountVES: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    dueDate: { type: DataTypes.DATE, allowNull: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await queryInterface.addIndex('charges', ['inscriptionId']);
  await queryInterface.addIndex('charges', ['schoolPeriodId']);
  await queryInterface.addIndex('charges', ['month']);
  await queryInterface.addIndex('charges', ['type']);

  // payments table
  await queryInterface.createTable('payments', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    inscriptionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'inscriptions', key: 'id' },
      onDelete: 'CASCADE',
    },
    schoolPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'school_periods', key: 'id' },
    },
    feeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'fees', key: 'id' },
    },
    sellableItemId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'sellable_items', key: 'id' },
    },
    chargeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'charges', key: 'id' },
    },
    month: { type: DataTypes.STRING(10), allowNull: true },
    amount: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
    currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'USD' },
    amountVES: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    exchangeRate: { type: DataTypes.DECIMAL(18, 6), allowNull: true },
    method: {
      type: DataTypes.ENUM('pago_movil', 'efectivo', 'transferencia', 'zelle', 'tarjeta', 'otro'),
      allowNull: false,
      defaultValue: 'efectivo',
    },
    reference: { type: DataTypes.STRING(100), allowNull: true },
    bank: { type: DataTypes.STRING(50), allowNull: true },
    paymentDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    notes: { type: DataTypes.TEXT, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await queryInterface.addIndex('payments', ['inscriptionId']);
  await queryInterface.addIndex('payments', ['schoolPeriodId']);
  await queryInterface.addIndex('payments', ['chargeId']);
  await queryInterface.addIndex('payments', ['month']);
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('payments');
  await queryInterface.dropTable('charges');
}
