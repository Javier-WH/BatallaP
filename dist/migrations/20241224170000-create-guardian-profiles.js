"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
module.exports = {
    up: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        yield queryInterface.createTable('guardian_profiles', {
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            firstName: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            lastName: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            documentType: {
                type: sequelize_1.DataTypes.ENUM('Venezolano', 'Extranjero', 'Pasaporte'),
                allowNull: false
            },
            document: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            phone: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            email: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            residenceState: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            residenceMunicipality: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            residenceParish: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            address: {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: false
            },
            createdAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize_1.DataTypes.NOW
            },
            updatedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize_1.DataTypes.NOW
            }
        });
        yield queryInterface.addConstraint('guardian_profiles', {
            type: 'unique',
            name: 'guardian_profiles_document_unique',
            fields: ['documentType', 'document']
        });
        yield queryInterface.addColumn('student_guardians', 'guardianId', {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'guardian_profiles',
                key: 'id'
            },
            onDelete: 'CASCADE'
        });
        yield queryInterface.sequelize.query(`
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
        yield queryInterface.sequelize.query(`
      UPDATE student_guardians sg
      INNER JOIN guardian_profiles gp
        ON gp.document = sg.document AND gp.documentType = 'Venezolano'
      SET sg.guardianId = gp.id
    `);
        yield queryInterface.changeColumn('student_guardians', 'guardianId', {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'guardian_profiles',
                key: 'id'
            },
            onDelete: 'CASCADE'
        });
        yield Promise.all([
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
    }),
    down: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        const columns = [
            { name: 'firstName', type: sequelize_1.DataTypes.STRING },
            { name: 'lastName', type: sequelize_1.DataTypes.STRING },
            { name: 'document', type: sequelize_1.DataTypes.STRING },
            { name: 'residenceState', type: sequelize_1.DataTypes.STRING },
            { name: 'residenceMunicipality', type: sequelize_1.DataTypes.STRING },
            { name: 'residenceParish', type: sequelize_1.DataTypes.STRING },
            { name: 'address', type: sequelize_1.DataTypes.TEXT },
            { name: 'phone', type: sequelize_1.DataTypes.STRING },
            { name: 'email', type: sequelize_1.DataTypes.STRING }
        ];
        for (const column of columns) {
            yield queryInterface.addColumn('student_guardians', column.name, {
                type: column.type,
                allowNull: true
            });
        }
        yield queryInterface.sequelize.query(`
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
        yield queryInterface.removeColumn('student_guardians', 'guardianId');
        yield queryInterface.dropTable('guardian_profiles');
    })
};
