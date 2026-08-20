import { QueryInterface, DataTypes } from 'sequelize';

// Stores the per-lapso (term) score for each inscription subject.
// Populated by FinalGradeCalculator and by the term grade sync service
// whenever qualifications or council points change.
// All views that need per-lapso grades (boletines, planillas, certified grades)
// read from this table to ensure consistency.

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('subject_term_grades', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    inscriptionSubjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'inscription_subjects',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    termId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'terms',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    score: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    },
    calculatedAt: {
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

  await queryInterface.addIndex('subject_term_grades', ['inscriptionSubjectId', 'termId'], {
    unique: true,
    name: 'subject_term_grades_inscription_subject_id_term_id_unique',
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('subject_term_grades');
}
