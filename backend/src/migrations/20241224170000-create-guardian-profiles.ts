import { QueryInterface, DataTypes } from 'sequelize';

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable('guardian_profiles', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      documentType: {
        type: DataTypes.ENUM('Venezolano', 'Extranjero', 'Pasaporte'),
        allowNull: false
      },
      document: {
        type: DataTypes.STRING,
        allowNull: false
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: false
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false
      },
      residenceState: {
        type: DataTypes.STRING,
        allowNull: false
      },
      residenceMunicipality: {
        type: DataTypes.STRING,
        allowNull: false
      },
      residenceParish: {
        type: DataTypes.STRING,
        allowNull: false
      },
      address: {
        type: DataTypes.TEXT,
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

    await queryInterface.addConstraint('guardian_profiles', {
      type: 'unique',
      name: 'guardian_profiles_document_unique',
      fields: ['documentType', 'document']
    });

    await queryInterface.addColumn('student_guardians', 'guardianId', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'guardian_profiles',
        key: 'id'
      },
      onDelete: 'CASCADE'
    });

    await queryInterface.sequelize.query(`
      INSERT INTO guardian_profiles (
        firstName,
        lastName,
        documentType,
        document,
        phone,
        email,
        residenceState,
        residenceMunicipality,
        residenceParish,
        address,
        createdAt,
        updatedAt
      )
      SELECT DISTINCT
        sg.firstName,
        sg.lastName,
        'Venezolano' AS documentType,
        sg.document,
        sg.phone,
        sg.email,
        sg.residenceState,
        sg.residenceMunicipality,
        sg.residenceParish,
        sg.address,
        sg.createdAt,
        sg.updatedAt
      FROM student_guardians sg
    `);

    await queryInterface.sequelize.query(`
      UPDATE student_guardians sg
      INNER JOIN guardian_profiles gp
        ON gp.document = sg.document AND gp.documentType = 'Venezolano'
      SET sg.guardianId = gp.id
    `);

    await queryInterface.changeColumn('student_guardians', 'guardianId', {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'guardian_profiles',
        key: 'id'
      },
      onDelete: 'CASCADE'
    });

    await Promise.all([
      'firstName',
      'lastName',
      'document',
      'residenceState',
      'residenceMunicipality',
      'residenceParish',
      'address',
      'phone',
      'email'
    ].map((column) => queryInterface.removeColumn('student_guardians', column)));
  },

  down: async (queryInterface: QueryInterface) => {
    const columns = [
      { name: 'firstName', type: DataTypes.STRING },
      { name: 'lastName', type: DataTypes.STRING },
      { name: 'document', type: DataTypes.STRING },
      { name: 'residenceState', type: DataTypes.STRING },
      { name: 'residenceMunicipality', type: DataTypes.STRING },
      { name: 'residenceParish', type: DataTypes.STRING },
      { name: 'address', type: DataTypes.TEXT },
      { name: 'phone', type: DataTypes.STRING },
      { name: 'email', type: DataTypes.STRING }
    ];

    for (const column of columns) {
      await queryInterface.addColumn('student_guardians', column.name, {
        type: column.type,
        allowNull: true
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE student_guardians sg
      INNER JOIN guardian_profiles gp ON gp.id = sg.guardianId
      SET
        sg.firstName = gp.firstName,
        sg.lastName = gp.lastName,
        sg.document = gp.document,
        sg.residenceState = gp.residenceState,
        sg.residenceMunicipality = gp.residenceMunicipality,
        sg.residenceParish = gp.residenceParish,
        sg.address = gp.address,
        sg.phone = gp.phone,
        sg.email = gp.email
    `);

    await queryInterface.removeColumn('student_guardians', 'guardianId');

    await queryInterface.dropTable('guardian_profiles');
  }
};
