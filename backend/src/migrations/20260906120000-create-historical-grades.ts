import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('historical_grades', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      personId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'people', key: 'id' },
        onDelete: 'CASCADE',
      },
      gradeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'grades', key: 'id' },
      },
      subjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'subjects', key: 'id' },
      },
      schoolPeriodId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'school_periods', key: 'id' },
      },
      finalScore: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('aprobada', 'reprobada'),
        allowNull: false,
        defaultValue: 'reprobada',
      },
      gradeType: {
        type: DataTypes.ENUM('regular', 'revision', 'materia_pendiente', 'transferencia', 'equivalencia'),
        allowNull: false,
        defaultValue: 'regular',
      },
      plantelId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'planteles', key: 'id' },
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
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

    await queryInterface.addIndex('historical_grades', {
      unique: true,
      fields: ['personId', 'gradeId', 'subjectId'],
      name: 'uq_historical_grades_person_grade_subject',
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('historical_grades');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_historical_grades_status');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_historical_grades_gradeType');
  },
};
