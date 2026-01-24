'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Remove the existing Foreign Key constraint
    await queryInterface.removeConstraint('matriculations', 'matriculations_ibfk_1');

    // 2. Add the new Foreign Key constraint with ON DELETE CASCADE
    await queryInterface.addConstraint('matriculations', {
      fields: ['personId'],
      type: 'foreign key',
      name: 'matriculations_person_id_fk_cascade',
      references: {
        table: 'people',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  async down(queryInterface, Sequelize) {
    // 1. Remove the cascade constraint
    await queryInterface.removeConstraint('matriculations', 'matriculations_person_id_fk_cascade');

    // 2. Add back the original restriction
    await queryInterface.addConstraint('matriculations', {
      fields: ['personId'],
      type: 'foreign key',
      name: 'matriculations_ibfk_1',
      references: {
        table: 'people',
        field: 'id'
      },
      onDelete: 'NO ACTION',
      onUpdate: 'CASCADE'
    });
  }
};
