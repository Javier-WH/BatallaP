import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';
import bcrypt from 'bcrypt';

interface UserAttributes {
  id: number;
  username: string;
  password?: string;
  role: 'admin' | 'teacher' | 'student';
  firstName: string;
  lastName: string;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id'> { }

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public username!: string;
  public password!: string;
  public role!: 'admin' | 'teacher' | 'student';
  public firstName!: string;
  public lastName!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('admin', 'teacher', 'student'),
      defaultValue: 'student',
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'users',
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => { // Handle password updates
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      }
    },
  }
);

export default User;
