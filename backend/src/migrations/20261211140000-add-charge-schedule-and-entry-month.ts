import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    const insc: any = await queryInterface.describeTable('inscriptions');
    if (!insc.entryMonth) {
      await queryInterface.addColumn('inscriptions', 'entryMonth', { type: DataTypes.STRING(3), allowNull: true, defaultValue: null });
    }

    const charges: any = await queryInterface.describeTable('charges');
    if (!charges.source) {
      await queryInterface.addColumn('charges', 'source', {
        type: DataTypes.ENUM('schedule', 'manual'),
        allowNull: false,
        defaultValue: 'manual',
      });
    }
    if (!charges.scheduleKey) {
      await queryInterface.addColumn('charges', 'scheduleKey', { type: DataTypes.STRING(60), allowNull: true });
    }

    const indexes: any[] = (await queryInterface.showIndex('charges')) as any[];
    if (!indexes.some(i => i.name === 'uq_charges_inscription_schedule_key')) {
      await queryInterface.addIndex('charges', ['inscriptionId', 'scheduleKey'], {
        unique: true,
        name: 'uq_charges_inscription_schedule_key',
      });
    }
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const indexes: any[] = (await queryInterface.showIndex('charges')) as any[];
    if (indexes.some(i => i.name === 'uq_charges_inscription_schedule_key')) {
      await queryInterface.removeIndex('charges', 'uq_charges_inscription_schedule_key');
    }
    const charges: any = await queryInterface.describeTable('charges');
    if (charges.scheduleKey) await queryInterface.removeColumn('charges', 'scheduleKey');
    if (charges.source) await queryInterface.removeColumn('charges', 'source');
    const insc: any = await queryInterface.describeTable('inscriptions');
    if (insc.entryMonth) await queryInterface.removeColumn('inscriptions', 'entryMonth');
  },
};
