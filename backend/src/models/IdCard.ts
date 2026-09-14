import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Person from './Person';

interface IdCardAttributes {
  id: number;
  personId: number;
  cardUid: string; // RFID UID from the physical card
  issuedAt: Date;
  revokedAt: Date | null;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

type IdCardCreationAttributes = Optional<
  IdCardAttributes,
  'id' | 'revokedAt' | 'active' | 'createdAt' | 'updatedAt'
>;

/**
 * RFID card assigned to a person. Foundation for the future gate check-in
 * system (hardware not deployed yet). 125kHz cards broadcast a static UID —
 * this is for attendance/notification purposes, not a security control.
 */
class IdCard
  extends Model<IdCardAttributes, IdCardCreationAttributes>
  implements IdCardAttributes
{
  public id!: number;
  public personId!: number;
  public cardUid!: string;
  public issuedAt!: Date;
  public revokedAt!: Date | null;
  public active!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

IdCard.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    personId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Person, key: 'id' },
      onDelete: 'CASCADE',
    },
    cardUid: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    issuedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'id_cards',
    indexes: [
      {
        fields: ['personId'],
      },
    ],
  }
);

export default IdCard;
