import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('bank_connections', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      provider: { type: DataTypes.STRING(40), allowNull: false },
      accountType: { type: DataTypes.ENUM('natural', 'juridica'), allowNull: false, defaultValue: 'natural' },
      label: { type: DataTypes.STRING(120), allowNull: false },
      username: { type: DataTypes.STRING(120), allowNull: true },
      password: { type: DataTypes.STRING(255), allowNull: true },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
  },
  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('bank_connections');
  },
};
