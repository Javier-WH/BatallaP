import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Inscription from './Inscription';
import SubjectGroup from './SubjectGroup';
import Subject from './Subject';
import Term from './Term';

/**
 * Records which subject (within a SubjectGroup) a student is taking during a
 * specific Term. Only applies to grouped subjects (Subject.subjectGroupId != null).
 *
 * Core subjects are always assigned and do not have a choice record.
 *
 * The pair (inscriptionId, subjectGroupId) identifies "the student's group slot"
 * (e.g. "Área Técnica" or "Área Deportiva"). Together with termId it pins down the
 * exact subject the student is taking in that lapso. This lets a student take
 * Música in L1 and Danza in L2-L3 without losing the L1 notes when switching.
 */
interface InscriptionGroupTermChoiceAttributes {
  id: number;
  inscriptionId: number;
  subjectGroupId: number;
  termId: number;
  subjectId: number;
}

interface InscriptionGroupTermChoiceCreationAttributes
  extends Optional<InscriptionGroupTermChoiceAttributes, 'id'> {}

class InscriptionGroupTermChoice
  extends Model<InscriptionGroupTermChoiceAttributes, InscriptionGroupTermChoiceCreationAttributes>
  implements InscriptionGroupTermChoiceAttributes
{
  public id!: number;
  public inscriptionId!: number;
  public subjectGroupId!: number;
  public termId!: number;
  public subjectId!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

InscriptionGroupTermChoice.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    inscriptionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Inscription, key: 'id' },
    },
    subjectGroupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: SubjectGroup, key: 'id' },
    },
    termId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Term, key: 'id' },
    },
    subjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Subject, key: 'id' },
    },
  },
  {
    sequelize,
    tableName: 'inscription_group_term_choices',
    indexes: [
      // One subject per (student's group slot, term).
      { unique: true, fields: ['inscriptionId', 'subjectGroupId', 'termId'], name: 'igt_choice_unique' },
    ],
  }
);

export default InscriptionGroupTermChoice;
