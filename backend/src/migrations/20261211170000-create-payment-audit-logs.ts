import { QueryInterface, DataTypes } from 'sequelize';

// Append-only trail of payment corrections (deleted / moved to another student).
export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('payment_audit_logs')) return;
    await queryInterface.createTable('payment_audit_logs', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      paymentId: { type: DataTypes.INTEGER, allowNull: false },
      action: { type: DataTypes.STRING(20), allowNull: false },
      fromInscriptionId: { type: DataTypes.INTEGER, allowNull: false },
      toInscriptionId: { type: DataTypes.INTEGER, allowNull: true },
      performedByPersonId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'people', key: 'id' } },
      reason: { type: DataTypes.STRING(500), allowNull: false },
      snapshot: { type: DataTypes.TEXT, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addIndex('payment_audit_logs', ['paymentId']);
    await queryInterface.addIndex('payment_audit_logs', ['fromInscriptionId']);
    await queryInterface.addIndex('payment_audit_logs', ['toInscriptionId']);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('payment_audit_logs');
  },
};
