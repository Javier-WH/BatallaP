import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable('period_closures', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      schoolPeriodId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'school_periods',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      status: {
        type: DataTypes.ENUM('draft', 'validating', 'closed', 'failed'),
        allowNull: false,
        defaultValue: 'draft'
      },
      initiatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      finishedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      log: {
        type: DataTypes.JSON,
        allowNull: true
      },
      snapshot: {
        type: DataTypes.JSON,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    await queryInterface.addIndex('period_closures', ['schoolPeriodId']);
    await queryInterface.addIndex('period_closures', ['status']);

    await queryInterface.createTable('council_checklists', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      schoolPeriodId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'school_periods',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      gradeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'grades',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      sectionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'sections',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      termId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'terms',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      status: {
        type: DataTypes.ENUM('open', 'in_review', 'done'),
        allowNull: false,
        defaultValue: 'open'
      },
      completedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    await queryInterface.addConstraint('council_checklists', {
      type: 'unique',
      fields: ['schoolPeriodId', 'gradeId', 'sectionId', 'termId'],
      name: 'uq_council_checklists_scope'
    });

    await queryInterface.addIndex('council_checklists', ['status']);

    await queryInterface.addColumn('inscriptions', 'originPeriodId', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'school_periods',
        key: 'id'
      },
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('inscriptions', 'isRepeater', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn('inscriptions', 'isRepeater');
    await queryInterface.removeColumn('inscriptions', 'originPeriodId');

    await queryInterface.dropTable('council_checklists');
    await queryInterface.dropTable('period_closures');

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_council_checklists_status');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_period_closures_status');
  }
};
