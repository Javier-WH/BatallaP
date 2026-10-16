import { QueryInterface, DataTypes } from 'sequelize';
import fs from 'fs';
import path from 'path';

// Creates the banks catalog table and seeds it with the Venezuelan bank
// list (Sudeban codes, names, RIFs and icon paths under /uploads/banks/).
// Source: bundled src/assets/banks.json.
export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('banks', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      code: {
        type: DataTypes.STRING(4),
        allowNull: false,
        unique: true,
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      shortName: {
        type: DataTypes.STRING(60),
        allowNull: false,
      },
      rif: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      icon: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });

    const catalogPath = path.resolve(__dirname, '..', 'assets', 'banks.json');
    const catalog: Array<{ code: string; name: string; shortName: string; rif: string | null; icon: string | null }> =
      JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
    const now = new Date();
    await queryInterface.bulkInsert(
      'banks',
      catalog.map(b => ({ ...b, active: true, createdAt: now, updatedAt: now })),
    );
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('banks');
  },
};
