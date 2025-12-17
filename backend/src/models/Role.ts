import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface RoleAttributes {
  id: number;
  name: 'Master' | 'Admin' | 'Teacher' | 'Tutor' | 'Student';
}

interface RoleCreationAttributes extends Optional<RoleAttributes, 'id'> { }

class Role extends Model<RoleAttributes, RoleCreationAttributes> implements RoleAttributes {
  public id!: number;
  public name!: 'Master' | 'Admin' | 'Teacher' | 'Tutor' | 'Student';

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Role.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.ENUM('Master', 'Admin', 'Teacher', 'Tutor', 'Student'),
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    tableName: 'roles',
  }
);

export default Role;
