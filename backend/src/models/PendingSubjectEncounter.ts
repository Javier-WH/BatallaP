import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import PendingSubject from './PendingSubject';

interface PendingSubjectEncounterAttributes {
  id: number;
  pendingSubjectId: number;
  encounterNumber: number;
  date?: Date | string | null;
  score?: number | null;
  isAbsent?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

type PendingSubjectEncounterCreationAttributes = Optional<
  PendingSubjectEncounterAttributes,
  'id' | 'date' | 'score' | 'isAbsent' | 'createdAt' | 'updatedAt'
>;

class PendingSubjectEncounter
  extends Model<PendingSubjectEncounterAttributes, PendingSubjectEncounterCreationAttributes>
  implements PendingSubjectEncounterAttributes
{
  public id!: number;
  public pendingSubjectId!: number;
  public encounterNumber!: number;
  public date!: Date | string | null;
  public score!: number | null;
  public isAbsent!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PendingSubjectEncounter.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    pendingSubjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: PendingSubject,
        key: 'id',
      },
    },
    encounterNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      defaultValue: null,
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      validate: {
        min: 0,
        max: 20,
      },
    },
    isAbsent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'pending_subject_encounters',
    indexes: [
      {
        unique: true,
        fields: ['pendingSubjectId', 'encounterNumber'],
      },
    ],
  }
);

export default PendingSubjectEncounter;
