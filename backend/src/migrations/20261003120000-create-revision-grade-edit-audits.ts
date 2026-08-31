import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const tables: any = await queryInterface.showAllTables();
    if (!tables.includes('revision_grade_edit_audits')) {
      await queryInterface.createTable('revision_grade_edit_audits', {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        revisionId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'inscription_subject_revisions',
            key: 'id',
          },
          comment: 'Revisión cuya nota fue modificada',
        },
        editedBy: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'people',
            key: 'id',
          },
          comment: 'Usuario de Control de Estudios que realizó la modificación',
        },
        previousScore: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: true,
        },
        newScore: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: true,
        },
        previousStatus: {
          type: DataTypes.ENUM('pending', 'approved', 'failed'),
          allowNull: false,
        },
        newStatus: {
          type: DataTypes.ENUM('pending', 'approved', 'failed'),
          allowNull: false,
        },
        previousIsAbsent: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        newIsAbsent: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        reason: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        editedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
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

      await queryInterface.addIndex('revision_grade_edit_audits', ['revisionId']);
      await queryInterface.addIndex('revision_grade_edit_audits', ['editedBy']);
      await queryInterface.addIndex('revision_grade_edit_audits', ['editedAt']);
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const tables: any = await queryInterface.showAllTables();
    if (tables.includes('revision_grade_edit_audits')) {
      await queryInterface.dropTable('revision_grade_edit_audits');
    }
  }
};
