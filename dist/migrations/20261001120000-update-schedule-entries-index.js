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
    up(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            // Drop the old unique index (scheduleId, day, period_id) that prevented multiple group subjects per cell
            try {
                yield queryInterface.removeIndex('schedule_entries', 'schedule_entries_schedule_id_day_period_id_unique');
            }
            catch (e) {
                // Index may have a different name — try the generic name
                try {
                    yield queryInterface.removeIndex('schedule_entries', 'scheduleId_day_period_id');
                }
                catch (e2) {
                    console.log('[migration] Old index not found, skipping drop');
                }
            }
            // Add new unique index that allows multiple group subjects but prevents duplicate (subject in same slot)
            try {
                yield queryInterface.addIndex('schedule_entries', ['scheduleId', 'day', 'period_id', 'subjectId'], {
                    unique: true,
                    name: 'schedule_entries_schedule_id_day_period_id_subject_id_unique',
                });
            }
            catch (e) {
                console.log('[migration] New index may already exist:', e.message);
            }
        });
    },
    down(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield queryInterface.removeIndex('schedule_entries', 'schedule_entries_schedule_id_day_period_id_subject_id_unique');
            }
            catch (e) {
                console.log('[migration] New index not found, skipping drop');
            }
            try {
                yield queryInterface.addIndex('schedule_entries', ['scheduleId', 'day', 'period_id'], {
                    unique: true,
                    name: 'schedule_entries_schedule_id_day_period_id_unique',
                });
            }
            catch (e) {
                console.log('[migration] Old index may already exist:', e.message);
            }
        });
    },
};
