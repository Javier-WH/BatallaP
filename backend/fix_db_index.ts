
import sequelize from './src/config/database';

const run = async () => {
  try {
    const qi = sequelize.getQueryInterface();
    // Try Removing the index (standard names + explicit definition name)
    const indexNames = [
      'inscriptions_school_period_id_person_id', // Snake case default
      'inscriptions_schoolPeriodId_personId',     // Camel case
      'inscriptions_school_period_id_person_id_unique' // Possible custom
    ];

    for (const name of indexNames) {
      try {
        await qi.removeIndex('inscriptions', name);
        console.log(`Index ${name} removed or not found.`);
      } catch (e: any) {
        // Ignore error if index doesn't exist
      }
    }
    console.log('Index cleanup attempt finished.');
  } catch (e: any) {
    console.error('Error:', e.message);
  }
};
run();
