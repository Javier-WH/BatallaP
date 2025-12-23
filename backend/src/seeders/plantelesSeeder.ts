import fs from 'fs';
import path from 'path';
import sequelize from '@/config/database';
import { Plantel } from '@/models/index';

interface PlantelJSON {
  code: string;
  name: string;
  state: string;
  dependency: string;
  municipality?: string;
  parish?: string;
}

const seedPlanteles = async () => {
  try {
    console.log('🌱 Starting planteles seeding...');

    // Check if planteles are already seeded
    const existingCount = await Plantel.count();
    if (existingCount > 0) {
      console.log(`ℹ️  Planteles already seeded (${existingCount} records found). Skipping...`);
      return;
    }

    // Read the JSON file
    const plantelesPath = path.resolve(process.cwd(), 'src/assets/planteles.json');
    console.log(`📖 Reading planteles from: ${plantelesPath}`);

    const rawData = fs.readFileSync(plantelesPath, 'utf-8');
    const planteles: PlantelJSON[] = JSON.parse(rawData);

    console.log(`📊 Found ${planteles.length} planteles in JSON file`);

    // Insert planteles in batches to avoid memory issues
    const batchSize = 1000;
    let insertedCount = 0;

    for (let i = 0; i < planteles.length; i += batchSize) {
      const batch = planteles.slice(i, i + batchSize);

      const plantelesToInsert = batch.map((plantel: any) => ({
        code: plantel.code,
        name: plantel.name,
        state: plantel.state,
        dependency: plantel.dependency,
        municipality: plantel.municipality || undefined,
        parish: plantel.parish || undefined
      }));

      await Plantel.bulkCreate(plantelesToInsert, {
        ignoreDuplicates: true,
        validate: true
      });

      insertedCount += batch.length;
      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(planteles.length / batchSize)} (${insertedCount}/${planteles.length})`);
    }

    console.log(`🎉 Successfully seeded ${insertedCount} planteles!`);

  } catch (error) {
    console.error('❌ Error seeding planteles:', error);
    throw error;
  }
};

// Run if called directly
if (require.main === module) {
  sequelize.authenticate()
    .then(() => {
      console.log('🔗 Database connected successfully');
      return sequelize.sync();
    })
    .then(() => {
      console.log('🔄 Database synchronized');
      return seedPlanteles();
    })
    .then(() => {
      console.log('✅ Planteles seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Planteles seeding failed:', error);
      process.exit(1);
    });
}

export default seedPlanteles;
