import { QueryInterface, DataTypes } from 'sequelize';

// Payments: more methods (platforms), the payer's account, who registered the
// payment, and duplicate protection (idempotency key + operation fingerprint).
// `method` becomes a plain string so new methods need no schema change; the
// allowed values are validated in paymentRulesService.
export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.changeColumn('payments', 'method', {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'efectivo',
    });
    await queryInterface.addColumn('payments', 'account', { type: DataTypes.STRING(100), allowNull: true });
    await queryInterface.addColumn('payments', 'registeredByPersonId', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'people', key: 'id' },
    });
    await queryInterface.addColumn('payments', 'clientRequestId', { type: DataTypes.STRING(64), allowNull: true });
    await queryInterface.addColumn('payments', 'dedupeKey', { type: DataTypes.STRING(255), allowNull: true });
    await queryInterface.addIndex('payments', ['clientRequestId'], { unique: true, name: 'payments_client_request_id_unique' });
    await queryInterface.addIndex('payments', ['dedupeKey'], { unique: true, name: 'payments_dedupe_key_unique' });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeIndex('payments', 'payments_dedupe_key_unique');
    await queryInterface.removeIndex('payments', 'payments_client_request_id_unique');
    await queryInterface.removeColumn('payments', 'dedupeKey');
    await queryInterface.removeColumn('payments', 'clientRequestId');
    await queryInterface.removeColumn('payments', 'registeredByPersonId');
    await queryInterface.removeColumn('payments', 'account');
  },
};
