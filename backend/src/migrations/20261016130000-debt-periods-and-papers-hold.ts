import { QueryInterface, DataTypes } from 'sequelize';

// Debts may belong to a school period other than the inscription's own (e.g.
// an unpaid fee of last year's August). Payments record which period's debt
// they settle (debtPeriodId) plus the amount expressed in the debt bucket's
// currency at the payment-date rate (equivalent / equivalentCurrency).
// inscriptions.papersHold marks withdrawn students whose documents are held
// until their debt is settled.
export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn('payments', 'debtPeriodId', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'school_periods', key: 'id' },
    });
    await queryInterface.addColumn('payments', 'equivalent', {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('payments', 'equivalentCurrency', {
      type: DataTypes.STRING(10),
      allowNull: true,
    });
    await queryInterface.addColumn('inscriptions', 'papersHold', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn('payments', 'debtPeriodId');
    await queryInterface.removeColumn('payments', 'equivalent');
    await queryInterface.removeColumn('payments', 'equivalentCurrency');
    await queryInterface.removeColumn('inscriptions', 'papersHold');
  },
};
