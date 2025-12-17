import User from './User';
import Person from './Person';
import Role from './Role';
import PersonRole from './PersonRole';
import Contact from './Contact';

// User <-> Person Association
User.hasOne(Person, {
  foreignKey: 'userId',
  as: 'person'
});

Person.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// Person <-> Contact Association (One-to-One)
Person.hasOne(Contact, {
  foreignKey: 'personId',
  as: 'contact'
});

Contact.belongsTo(Person, {
  foreignKey: 'personId',
  as: 'person'
});

// Person <-> Role Association (Many-to-Many)
Person.belongsToMany(Role, {
  through: PersonRole,
  foreignKey: 'personId',
  otherKey: 'roleId',
  as: 'roles'
});

Role.belongsToMany(Person, {
  through: PersonRole,
  foreignKey: 'roleId',
  otherKey: 'personId',
  as: 'people'
});

export {
  User,
  Person,
  Role,
  PersonRole,
  Contact
};
