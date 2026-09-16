"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
/**
 * Drops `sectionId` from `thematic_components` so content is shared across
 * all sections of the same periodGradeSubject + term.
 *
 * Before dropping the column, duplicate components (same pgsId + termId, from
 * different sections) are deduplicated: the oldest one is kept and its
 * contents/learnings are preserved. EvaluationPlan references
 * (thematicComponentId, thematicContentIds) and ExpectedLearningContent
 * associations are remapped to the kept component's contents.
 */
function up(queryInterface) {
    return __awaiter(this, void 0, void 0, function* () {
        const sequelize = queryInterface.sequelize;
        // 1. Find duplicate groups: same (periodGradeSubjectId, termId) with > 1 component
        const dupes = yield sequelize.query(`SELECT periodGradeSubjectId AS pgsId, termId
       FROM thematic_components
      GROUP BY periodGradeSubjectId, termId
     HAVING COUNT(*) > 1`, { type: sequelize_1.QueryTypes.SELECT });
        for (const { pgsId, termId } of dupes) {
            // 2. Get all components in this group, ordered by id ASC (oldest = keeper)
            const components = yield sequelize.query(`SELECT id FROM thematic_components
        WHERE periodGradeSubjectId = ${pgsId} AND termId = ${termId}
        ORDER BY id ASC`, { type: sequelize_1.QueryTypes.SELECT });
            if (components.length <= 1)
                continue;
            const keeperId = components[0].id;
            const duplicateIds = components.slice(1).map(c => c.id);
            // 3. For each duplicate, remap its contents to the keeper's contents (match by title)
            for (const dupId of duplicateIds) {
                // Get contents of the duplicate
                const dupContents = yield sequelize.query(`SELECT id, title, \`order\` FROM thematic_contents
          WHERE thematicComponentId = ${dupId}`, { type: sequelize_1.QueryTypes.SELECT });
                // Get keeper contents for matching
                const keeperContents = yield sequelize.query(`SELECT id, title, \`order\` FROM thematic_contents
          WHERE thematicComponentId = ${keeperId}`, { type: sequelize_1.QueryTypes.SELECT });
                // Build a content-id remap: oldContentId -> newContentId (keeper)
                const contentRemap = new Map();
                for (const dupContent of dupContents) {
                    // Match by title (case-insensitive, trimmed)
                    const match = keeperContents.find(kc => kc.title.trim().toLowerCase() === dupContent.title.trim().toLowerCase());
                    if (match) {
                        contentRemap.set(dupContent.id, match.id);
                    }
                    // If no match, the content will be lost (it's a duplicate that doesn't
                    // exist in the keeper). This is acceptable since the keeper is the
                    // canonical version.
                }
                // 4. Remap ExpectedLearningContent associations
                for (const [oldContentId, newContentId] of contentRemap) {
                    // Move associations to the keeper's content, avoiding duplicates
                    yield sequelize.query(`INSERT IGNORE INTO expected_learning_contents (learningId, contentId, createdAt, updatedAt)
           SELECT learningId, ${newContentId}, NOW(), NOW()
             FROM expected_learning_contents
            WHERE contentId = ${oldContentId}`);
                    // Delete old associations
                    yield sequelize.query(`DELETE FROM expected_learning_contents WHERE contentId = ${oldContentId}`);
                }
                // 5. Remap EvaluationPlan.thematicComponentId
                yield sequelize.query(`UPDATE evaluation_plans
            SET thematicComponentId = ${keeperId}
          WHERE thematicComponentId = ${dupId}`);
                // 6. Remap EvaluationPlan.thematicContentIds (JSON array of content IDs)
                const plansWithContentIds = yield sequelize.query(`SELECT id, thematicContentIds FROM evaluation_plans
          WHERE thematicContentIds IS NOT NULL
            AND JSON_CONTAINS(thematicContentIds, CAST(${dupId} AS JSON))`, { type: sequelize_1.QueryTypes.SELECT });
                // Also remap any plan that references any of the duplicate's content IDs
                for (const dupContent of dupContents) {
                    const plansReferencing = yield sequelize.query(`SELECT id, thematicContentIds FROM evaluation_plans
            WHERE thematicContentIds IS NOT NULL
              AND JSON_CONTAINS(thematicContentIds, CAST(${dupContent.id} AS JSON))`, { type: sequelize_1.QueryTypes.SELECT });
                    for (const plan of plansReferencing) {
                        if (!plan.thematicContentIds)
                            continue;
                        try {
                            const ids = JSON.parse(plan.thematicContentIds);
                            const remapped = ids.map(id => { var _a; return (_a = contentRemap.get(id)) !== null && _a !== void 0 ? _a : id; });
                            // Remove duplicates that may arise from remapping
                            const unique = [...new Set(remapped)];
                            yield sequelize.query(`UPDATE evaluation_plans SET thematicContentIds = '${JSON.stringify(unique).replace(/'/g, "''")}' WHERE id = ${plan.id}`);
                        }
                        catch (_a) {
                            // Skip if JSON parse fails
                        }
                    }
                }
                // 7. Delete the duplicate's contents (associations already moved)
                yield sequelize.query(`DELETE FROM thematic_contents WHERE thematicComponentId = ${dupId}`);
                // 8. Delete the duplicate component
                yield sequelize.query(`DELETE FROM thematic_components WHERE id = ${dupId}`);
            }
        }
        // 9. Drop the sectionId column
        yield queryInterface.removeColumn('thematic_components', 'sectionId');
    });
}
function down(queryInterface) {
    return __awaiter(this, void 0, void 0, function* () {
        // Re-add sectionId as nullable (can't restore original values)
        const DataTypes = (yield Promise.resolve().then(() => __importStar(require('sequelize')))).DataTypes;
        yield queryInterface.addColumn('thematic_components', 'sectionId', {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
        });
    });
}
