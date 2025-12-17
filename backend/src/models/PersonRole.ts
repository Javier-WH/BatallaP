import { DataTypes, Model } from 'sequelize';
import sequelize from '@/config/database';
import Person from './Person';
import Role from './Role';

class PersonRole extends Model {
  public personId!: number;
  public roleId!: number;
}

PersonRole.init(
  {
    personId: {
      type: DataTypes.INTEGER,
      references: {
        model: Person,
        key: 'id',
      },
    },
    roleId: {
      type: DataTypes.INTEGER,
      references: {
        model: Role,
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'person_roles',
    timestamps: false,
  }
);

export default PersonRole;
