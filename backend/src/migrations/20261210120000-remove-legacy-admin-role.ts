import { QueryInterface } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    // 'Admin' is a legacy non-canonical role created on the fly by the old
    // register endpoint. It grants no access anywhere — the canonical role
    // is 'Administrador'. Remove its assignments and the role row itself;
    // affected people keep no role until Master reassigns one via Directorio.
    const [rows] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE name = 'Admin'`
    );
    const adminRole = (rows as Array<{ id: number }>)[0];
    if (!adminRole) return;

    await queryInterface.sequelize.query(
      `DELETE FROM person_roles WHERE roleId = ${adminRole.id}`
    );
    await queryInterface.sequelize.query(
      `DELETE FROM roles WHERE id = ${adminRole.id}`
    );
  },

  async down(): Promise<void> {
    // No-op: the legacy 'Admin' role must not be recreated.
  },
};
