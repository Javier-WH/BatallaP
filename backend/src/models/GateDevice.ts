import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface GateDeviceAttributes {
  id: number;
  type: 'gate_reader' | 'mobile';
  identifier: string;
  location: string | null;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

type GateDeviceCreationAttributes = Optional<
  GateDeviceAttributes,
  'id' | 'location' | 'active' | 'createdAt' | 'updatedAt'
>;

/**
 * Physical reader device at a gate (or a mobile device). Foundation for the
 * future gate check-in system — hardware not deployed yet.
 */
class GateDevice
  extends Model<GateDeviceAttributes, GateDeviceCreationAttributes>
  implements GateDeviceAttributes
{
  public id!: number;
  public type!: 'gate_reader' | 'mobile';
  public identifier!: string;
  public location!: string | null;
  public active!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

GateDevice.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    type: {
      type: DataTypes.ENUM('gate_reader', 'mobile'),
      allowNull: false,
      defaultValue: 'gate_reader',
    },
    identifier: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    location: {
      type: DataTypes.STRING(150),
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
    tableName: 'gate_devices',
  }
);

export default GateDevice;
