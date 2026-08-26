import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    // 1. exchange_rate_types
    await queryInterface.createTable('exchange_rate_types', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      code: { type: DataTypes.STRING(30), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'USD' },
      isDefault: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });

    // 2. exchange_rates
    await queryInterface.createTable('exchange_rates', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      exchangeRateTypeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'exchange_rate_types', key: 'id' },
        onDelete: 'CASCADE',
      },
      rate: { type: DataTypes.DECIMAL(18, 4), allowNull: false },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('exchange_rates', {
      unique: true,
      fields: ['exchangeRateTypeId', 'date'],
      name: 'uq_exchange_rate_type_date',
    });
    await queryInterface.addIndex('exchange_rates', { fields: ['date'] });

    // 3. fees
    await queryInterface.createTable('fees', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      schoolPeriodId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'school_periods', key: 'id' },
        onDelete: 'CASCADE',
      },
      key: {
        type: DataTypes.ENUM('mensualidad', 'matricula', 'gastos_administrativos'),
        allowNull: false,
      },
      name: { type: DataTypes.STRING(100), allowNull: false },
      amount: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
      exchangeRateTypeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'exchange_rate_types', key: 'id' },
      },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('fees', {
      unique: true,
      fields: ['schoolPeriodId', 'key'],
      name: 'uq_fees_period_key',
    });
    await queryInterface.addIndex('fees', { fields: ['active'] });

    // 4. sellable_items
    await queryInterface.createTable('sellable_items', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(200), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      amount: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
      exchangeRateTypeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'exchange_rate_types', key: 'id' },
      },
      category: { type: DataTypes.STRING(100), allowNull: true },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('sellable_items', { fields: ['active'] });
    await queryInterface.addIndex('sellable_items', { fields: ['category'] });

    // 5. enrollment_plans
    await queryInterface.createTable('enrollment_plans', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      targetExchangeRateTypeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'exchange_rate_types', key: 'id' },
      },
      conversionMode: {
        type: DataTypes.ENUM('exchange_rate', 'same_amount'),
        allowNull: false,
        defaultValue: 'exchange_rate',
      },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('enrollment_plans', { fields: ['active'] });

    // 6. enrollment_plan_items
    await queryInterface.createTable('enrollment_plan_items', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      enrollmentPlanId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'enrollment_plans', key: 'id' },
        onDelete: 'CASCADE',
      },
      itemType: {
        type: DataTypes.ENUM('fee', 'sellable_item'),
        allowNull: false,
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
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('enrollment_plan_items', { fields: ['enrollmentPlanId'] });
    await queryInterface.addIndex('enrollment_plan_items', { fields: ['feeId'] });
    await queryInterface.addIndex('enrollment_plan_items', { fields: ['sellableItemId'] });

    // Seed: default exchange rate types (Venezuela)
    await queryInterface.bulkInsert('exchange_rate_types', [
      { code: 'USD_BCV', name: 'Dólar BCV', currency: 'USD', isDefault: true, active: true, createdAt: new Date(), updatedAt: new Date() },
      { code: 'EUR_BCV', name: 'Euro BCV', currency: 'EUR', isDefault: false, active: true, createdAt: new Date(), updatedAt: new Date() },
      { code: 'USD_PARALLEL', name: 'Dólar Paralelo', currency: 'USD', isDefault: false, active: true, createdAt: new Date(), updatedAt: new Date() },
      { code: 'USD_CASH', name: 'Dólar en Efectivo', currency: 'USD', isDefault: false, active: true, createdAt: new Date(), updatedAt: new Date() },
      { code: 'VES', name: 'Bolívar (VES)', currency: 'VES', isDefault: false, active: true, createdAt: new Date(), updatedAt: new Date() },
    ]);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('enrollment_plan_items');
    await queryInterface.dropTable('enrollment_plans');
    await queryInterface.dropTable('sellable_items');
    await queryInterface.dropTable('fees');
    await queryInterface.dropTable('exchange_rates');
    await queryInterface.dropTable('exchange_rate_types');
    // Drop ENUM types created by PostgreSQL (MySQL drops them automatically with the table)
  },
};
