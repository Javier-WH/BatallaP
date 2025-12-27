import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable('subject_final_grades', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      inscriptionSubjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'inscription_subjects',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      finalScore: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
      },
      rawScore: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
      },
      councilPoints: {
        type: DataTypes.DECIMAL(4, 2),
        allowNull: true,
        defaultValue: 0
      },
      status: {
        type: DataTypes.ENUM('aprobada', 'reprobada'),
        allowNull: false,
        defaultValue: 'aprobada'
      },
      calculatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
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

    await queryInterface.addConstraint('subject_final_grades', {
      type: 'unique',
      fields: ['inscriptionSubjectId'],
      name: 'uq_subject_final_grades_inscription_subject'
    });

    await queryInterface.createTable('student_period_outcomes', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      inscriptionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'inscriptions',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      finalAverage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
      },
      failedSubjects: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0
      },
      status: {
        type: DataTypes.ENUM('aprobado', 'materias_pendientes', 'reprobado'),
        allowNull: false,
        defaultValue: 'aprobado'
      },
      promotionGradeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'grades',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      graduatedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      metadata: {
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

    await queryInterface.addConstraint('student_period_outcomes', {
      type: 'unique',
      fields: ['inscriptionId'],
      name: 'uq_student_period_outcomes_inscription'
    });

    await queryInterface.createTable('pending_subjects', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      newInscriptionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'inscriptions',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      subjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'subjects',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      originPeriodId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'school_periods',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      status: {
        type: DataTypes.ENUM('pendiente', 'aprobada', 'convalidada'),
        allowNull: false,
        defaultValue: 'pendiente'
      },
      resolvedAt: {
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

    await queryInterface.addConstraint('pending_subjects', {
      type: 'unique',
      fields: ['newInscriptionId', 'subjectId'],
      name: 'uq_pending_subjects_inscription_subject'
    });

    await queryInterface.addIndex('pending_subjects', ['newInscriptionId']);

    await queryInterface.createTable('school_period_transition_rules', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      gradeFromId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'grades',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      gradeToId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'grades',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      minAverage: {
        type: DataTypes.DECIMAL(4, 2),
        allowNull: false,
        defaultValue: 10
      },
      maxPendingSubjects: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0
      },
      autoGraduate: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
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

    await queryInterface.addConstraint('school_period_transition_rules', {
      type: 'unique',
      fields: ['gradeFromId'],
      name: 'uq_transition_rules_grade_from'
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('school_period_transition_rules');
    await queryInterface.dropTable('pending_subjects');
    await queryInterface.dropTable('student_period_outcomes');
    await queryInterface.dropTable('subject_final_grades');

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_subject_final_grades_status');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_student_period_outcomes_status');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_pending_subjects_status');
  }
};
