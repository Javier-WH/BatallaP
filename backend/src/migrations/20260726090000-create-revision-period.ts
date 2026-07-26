import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable('revision_periods', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      schoolPeriodId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'school_periods',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      status: {
        type: DataTypes.ENUM('pending', 'open', 'closed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      maxOpportunities: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 3,
      },
      passingGrade: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 10.0,
      },
      openedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      closedAt: {
        type: DataTypes.DATE,
        allowNull: true,
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

    await queryInterface.addConstraint('revision_periods', {
      type: 'unique',
      fields: ['schoolPeriodId'],
      name: 'uq_revision_periods_school_period',
    });

    await queryInterface.createTable('inscription_subject_revisions', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      revisionPeriodId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'revision_periods',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      inscriptionSubjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'inscription_subjects',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      opportunity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      score: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      gradedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'people',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      gradedAt: {
        type: DataTypes.DATE,
        allowNull: true,
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

    await queryInterface.addConstraint('inscription_subject_revisions', {
      type: 'unique',
      fields: ['revisionPeriodId', 'inscriptionSubjectId', 'opportunity'],
      name: 'uq_inscription_subject_revisions',
    });

    await queryInterface.addIndex('inscription_subject_revisions', ['inscriptionSubjectId']);

    // Add historic fields to subject_final_grades
    await queryInterface.addColumn('subject_final_grades', 'originalScore', {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    });

    await queryInterface.addColumn('subject_final_grades', 'originalStatus', {
      type: DataTypes.ENUM('aprobada', 'reprobada'),
      allowNull: true,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn('subject_final_grades', 'originalStatus');
    await queryInterface.removeColumn('subject_final_grades', 'originalScore');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_inscription_subject_revisions_status');
    await queryInterface.dropTable('inscription_subject_revisions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_revision_periods_status');
    await queryInterface.dropTable('revision_periods');
  },
};
