import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('qualification_audits', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    qualificationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'qualifications', key: 'id' },
    },
    editedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    previousScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    newScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
    },
    editedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  await queryInterface.addIndex('qualification_audits', ['qualificationId']);
  await queryInterface.addIndex('qualification_audits', ['editedBy']);
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('qualification_audits');
}