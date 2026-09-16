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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    up: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        // Drop the old unique index on inscriptionSubjectId alone
        // The index name in MySQL is auto-generated; find and drop it.
        try {
            yield queryInterface.removeIndex('subject_final_grades', 'subject_final_grades_inscription_subject_id');
        }
        catch (_a) {
            // Index name may vary; try the Sequelize-generated name
            try {
                yield queryInterface.removeIndex('subject_final_grades', 'inscription_subject_id');
            }
            catch (_b) {
                // If neither exists, skip — sync() will have created the new one
            }
        }
        // Create the new composite unique index
        yield queryInterface.addIndex('subject_final_grades', {
            fields: ['inscriptionSubjectId', 'gradeType'],
            unique: true,
            name: 'idx_subject_final_grades_inssub_gradetype',
        });
    }),
    down: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        yield queryInterface.removeIndex('subject_final_grades', 'idx_subject_final_grades_inssub_gradetype');
        yield queryInterface.addIndex('subject_final_grades', {
            fields: ['inscriptionSubjectId'],
            unique: true,
        });
    })
};
