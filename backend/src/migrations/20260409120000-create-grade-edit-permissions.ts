import { QueryInterface, DataTypes } from 'sequelize';

export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable('grade_edit_permissions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      schoolPeriodId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'school_periods',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Null = permiso global para todos los períodos'
      },
      grantedBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Administrador que otorgó el permiso'
      },
      grantedTo: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Usuario de Control de Estudios receptor del permiso'
      },
      actCode: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Código de acta que justifica el permiso'
      },
      observations: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Observaciones sobre el permiso otorgado'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Indica si el permiso está activo'
      },
      grantedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Fecha y hora cuando se otorgó el permiso'
      },
      revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha y hora cuando se revocó el permiso'
      },
      revokedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Administrador que revocó el permiso'
      },
      createdAt: {
        allowNull: false,
        type: DataTypes.DATE
      },
      updatedAt: {
        allowNull: false,
        type: DataTypes.DATE
      }
    });

    // Add indexes
    await queryInterface.addIndex('grade_edit_permissions', ['schoolPeriodId', 'grantedTo']);
    await queryInterface.addIndex('grade_edit_permissions', ['grantedTo']);
    await queryInterface.addIndex('grade_edit_permissions', ['isActive']);

    await queryInterface.createTable('grade_edit_audits', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      subjectFinalGradeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'subject_final_grades',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Nota final que fue modificada'
      },
      permissionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'grade_edit_permissions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Permiso que autorizó la modificación'
      },
      editedBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Usuario que realizó la modificación'
      },
      previousScore: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Valor de la nota antes de la modificación'
      },
      newScore: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Valor de la nota después de la modificación'
      },
      previousStatus: {
        type: DataTypes.ENUM('aprobada', 'reprobada'),
        allowNull: false,
        comment: 'Estado de la materia antes de la modificación'
      },
      newStatus: {
        type: DataTypes.ENUM('aprobada', 'reprobada'),
        allowNull: false,
        comment: 'Estado de la materia después de la modificación'
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Razón de la modificación'
      },
      editedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Fecha y hora de la modificación'
      },
      createdAt: {
        allowNull: false,
        type: DataTypes.DATE
      },
      updatedAt: {
        allowNull: false,
        type: DataTypes.DATE
      }
    });

    // Add indexes
    await queryInterface.addIndex('grade_edit_audits', ['subjectFinalGradeId']);
    await queryInterface.addIndex('grade_edit_audits', ['permissionId']);
    await queryInterface.addIndex('grade_edit_audits', ['editedBy']);
    await queryInterface.addIndex('grade_edit_audits', ['editedAt']);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('grade_edit_audits');
    await queryInterface.dropTable('grade_edit_permissions');
  }
};
