"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
class GuardianProfile extends sequelize_1.Model {
}
GuardianProfile.init({
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
        allowNull: false,
        unique: 'guardian_document_unique'
    },
    phone: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    phone2: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    whatsapp: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
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
    occupation: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    birthdate: {
        type: sequelize_1.DataTypes.DATEONLY,
        allowNull: true
    }
}, {
    sequelize: database_1.default,
    tableName: 'guardian_profiles',
    indexes: [
        {
            unique: true,
            fields: ['documentType', 'document'],
            name: 'guardian_profiles_document_unique'
        }
    ],
    hooks: {
        beforeCreate: (instance) => {
            if (instance.firstName)
                instance.firstName = instance.firstName.toUpperCase().trim();
            if (instance.lastName)
                instance.lastName = instance.lastName.toUpperCase().trim();
            if (instance.occupation)
                instance.occupation = instance.occupation.toUpperCase().trim();
            if (instance.residenceState)
                instance.residenceState = instance.residenceState.toUpperCase().trim();
            if (instance.residenceMunicipality)
                instance.residenceMunicipality = instance.residenceMunicipality.toUpperCase().trim();
            if (instance.residenceParish)
                instance.residenceParish = instance.residenceParish.toUpperCase().trim();
            if (instance.address)
                instance.address = instance.address.toUpperCase().trim();
        },
        beforeUpdate: (instance) => {
            if (instance.changed('firstName') && instance.firstName)
                instance.firstName = instance.firstName.toUpperCase().trim();
            if (instance.changed('lastName') && instance.lastName)
                instance.lastName = instance.lastName.toUpperCase().trim();
            if (instance.changed('occupation') && instance.occupation)
                instance.occupation = instance.occupation.toUpperCase().trim();
            if (instance.changed('residenceState') && instance.residenceState)
                instance.residenceState = instance.residenceState.toUpperCase().trim();
            if (instance.changed('residenceMunicipality') && instance.residenceMunicipality)
                instance.residenceMunicipality = instance.residenceMunicipality.toUpperCase().trim();
            if (instance.changed('residenceParish') && instance.residenceParish)
                instance.residenceParish = instance.residenceParish.toUpperCase().trim();
            if (instance.changed('address') && instance.address)
                instance.address = instance.address.toUpperCase().trim();
        }
    }
});
exports.default = GuardianProfile;
