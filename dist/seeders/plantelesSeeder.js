"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = __importDefault(require("../config/database.js"));
const index_1 = require("../models/index.js");
const seedPlanteles = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('🌱 Starting planteles seeding...');
        // Check if planteles are already seeded
        const existingCount = yield index_1.Plantel.count();
        if (existingCount > 0) {
            console.log(`ℹ️  Planteles already seeded (${existingCount} records found). Skipping...`);
            return;
        }
        // Read the JSON file
        const plantelesPath = path_1.default.resolve(process.cwd(), 'src/assets/planteles.json');
        console.log(`📖 Reading planteles from: ${plantelesPath}`);
        const rawData = fs_1.default.readFileSync(plantelesPath, 'utf-8');
        const planteles = JSON.parse(rawData);
        console.log(`📊 Found ${planteles.length} planteles in JSON file`);
        // Insert planteles in batches to avoid memory issues
        const batchSize = 1000;
        let insertedCount = 0;
        for (let i = 0; i < planteles.length; i += batchSize) {
            const batch = planteles.slice(i, i + batchSize);
            const plantelesToInsert = batch.map((plantel) => ({
                code: plantel.deaCode,
                name: plantel.name,
                state: plantel.state,
                dependency: undefined,
                municipality: undefined,
                parish: undefined
            }));
            yield index_1.Plantel.bulkCreate(plantelesToInsert, {
                ignoreDuplicates: true,
                validate: true
            });
            insertedCount += batch.length;
            console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(planteles.length / batchSize)} (${insertedCount}/${planteles.length})`);
        }
        console.log(`🎉 Successfully seeded ${insertedCount} planteles!`);
    }
    catch (error) {
        console.error('❌ Error seeding planteles:', error);
        throw error;
    }
});
// Run if called directly
if (require.main === module) {
    database_1.default.authenticate()
        .then(() => {
        console.log('🔗 Database connected successfully');
        return database_1.default.sync();
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
exports.default = seedPlanteles;
