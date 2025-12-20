import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/config/database';

interface RoleAttributes {
  id: number;
  name: 'Master' | 'Administrador' | 'Control de Estudios' | 'Profesor' | 'Representante' | 'Alumno';
}

interface RoleCreationAttributes extends Optional<RoleAttributes, 'id'> { }

class Role extends Model<RoleAttributes, RoleCreationAttributes> implements RoleAttributes {
  public id!: number;
  public name!: 'Master' | 'Administrador' | 'Control de Estudios' | 'Profesor' | 'Representante' | 'Alumno';

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
      type: DataTypes.STRING(30), // Increased length to accommodate Spanish role names
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
