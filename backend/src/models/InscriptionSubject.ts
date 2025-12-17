import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Inscription from './Inscription';
import Subject from './Subject';

interface InscriptionSubjectAttributes {
  id: number;
  inscriptionId: number;
  subjectId: number;
}

interface InscriptionSubjectCreationAttributes extends Optional<InscriptionSubjectAttributes, 'id'> { }

class InscriptionSubject extends Model<InscriptionSubjectAttributes, InscriptionSubjectCreationAttributes> implements InscriptionSubjectAttributes {
  public id!: number;
  public inscriptionId!: number;
  public subjectId!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

InscriptionSubject.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    inscriptionId: {
      type: DataTypes.INTEGER,
      references: { model: Inscription, key: 'id' },
      allowNull: false
    },
    subjectId: {
      type: DataTypes.INTEGER,
      references: { model: Subject, key: 'id' },
      allowNull: false
    }
  },
  {
    sequelize,
    tableName: 'inscription_subjects',
    indexes: [
      {
        unique: true,
        fields: ['inscriptionId', 'subjectId']
      }
    ]
  }
);

export default InscriptionSubject;
