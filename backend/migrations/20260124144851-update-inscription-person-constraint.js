'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Remove the existing Foreign Key constraint
    // The error message identified it as 'inscriptions_ibfk_4'
    await queryInterface.removeConstraint('inscriptions', 'inscriptions_ibfk_4');

    // 2. Add the new Foreign Key constraint with ON DELETE CASCADE
    await queryInterface.addConstraint('inscriptions', {
      fields: ['personId'],
      type: 'foreign key',
      name: 'inscriptions_person_id_fk_cascade', // New explicit name
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
    await queryInterface.removeConstraint('inscriptions', 'inscriptions_person_id_fk_cascade');

    // 2. Add back the original restriction (NO ACTION usually or RESTRICT)
    await queryInterface.addConstraint('inscriptions', {
      fields: ['personId'],
      type: 'foreign key',
      name: 'inscriptions_ibfk_4', // Restore original name if possible
      references: {
        table: 'people',
        field: 'id'
      },
      onDelete: 'NO ACTION',
      onUpdate: 'CASCADE'
    });
  }
};
