import { QueryInterface, DataTypes } from 'sequelize';

// A school period may accept USD/USDT at par (1:1) against EUR debts:
// school_periods.usdAtPar is the switch, payments.atPar marks the payments
// that were credited at face value instead of converted by exchange rate.
export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn('school_periods', 'usdAtPar', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('payments', 'atPar', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn('payments', 'atPar');
    await queryInterface.removeColumn('school_periods', 'usdAtPar');
  },
};
