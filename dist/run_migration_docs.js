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
const umzug_1 = require("umzug");
const database_1 = __importDefault(require("./config/database")); // Adjust path if needed
const path_1 = __importDefault(require("path"));
const runMigration = () => __awaiter(void 0, void 0, void 0, function* () {
    const umzug = new umzug_1.Umzug({
        migrations: {
            glob: path_1.default.join(__dirname, 'migrations/*.ts'),
            resolve: ({ name, path: migrationPath, context }) => {
                // Adjust depending on how your migrations are exported
                const migration = require(migrationPath);
                return {
                    name,
                    up: () => __awaiter(void 0, void 0, void 0, function* () { return migration.default.up(context); }),
                    down: () => __awaiter(void 0, void 0, void 0, function* () { return migration.default.down(context); }),
                };
            },
        },
        context: database_1.default.getQueryInterface(),
        storage: new umzug_1.SequelizeStorage({ sequelize: database_1.default }),
        logger: console,
    });
    try {
        yield database_1.default.authenticate();
        console.log('Database connected.');
        // Explicitly run the new migration file
        // Filter to only run the new one if we want to be safe, or just 'up' which runs pending.
        // Given the previous usage, 'up' is likely fine.
        yield umzug.up();
        console.log('Migration executed successfully.');
    }
    catch (error) {
        console.error('Migration failed:', error);
    }
    finally {
        process.exit(0);
    }
});
runMigration();
