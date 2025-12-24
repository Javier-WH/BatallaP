import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable('enrollment_answers', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      questionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'enrollment_questions',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      personId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'people',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      answer: {
        type: DataTypes.JSON,
        allowNull: false
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

    await queryInterface.addConstraint('enrollment_answers', {
      type: 'unique',
      fields: ['questionId', 'personId'],
      name: 'uq_enrollment_answers_question_person'
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('enrollment_answers');
  }
};
