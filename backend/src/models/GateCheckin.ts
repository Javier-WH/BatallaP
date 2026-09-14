import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import Person from './Person';
import GateDevice from './GateDevice';

interface GateCheckinAttributes {
  id: number;
  personId: number | null;
  cardUid: string;
  deviceId: number | null;
  eventType: 'entry' | 'exit';
  timestamp: Date;
  flaggedDuplicate: boolean; // tap within the 60s review window (see debounce logic)
  createdAt?: Date;
  updatedAt?: Date;
}

type GateCheckinCreationAttributes = Optional<
  GateCheckinAttributes,
  'id' | 'personId' | 'deviceId' | 'flaggedDuplicate' | 'createdAt' | 'updatedAt'
>;

/**
 * Gate check-in event from an RFID reader. Foundation for the future gate
 * check-in system — hardware not deployed yet. The endpoint applies the
 * debounce/toggle logic from the spec so readers can be integrated later
 * without schema changes.
 */
class GateCheckin
  extends Model<GateCheckinAttributes, GateCheckinCreationAttributes>
  implements GateCheckinAttributes
{
  public id!: number;
  public personId!: number | null;
  public cardUid!: string;
  public deviceId!: number | null;
  public eventType!: 'entry' | 'exit';
  public timestamp!: Date;
  public flaggedDuplicate!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

GateCheckin.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    personId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: Person, key: 'id' },
      onDelete: 'SET NULL',
    },
    cardUid: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    deviceId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: GateDevice, key: 'id' },
      onDelete: 'SET NULL',
    },
    eventType: {
      type: DataTypes.ENUM('entry', 'exit'),
      allowNull: false,
      defaultValue: 'entry',
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    flaggedDuplicate: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'gate_checkins',
    indexes: [
      {
        fields: ['personId', 'timestamp'],
      },
      {
        fields: ['cardUid'],
      },
    ],
  }
);

export default GateCheckin;
