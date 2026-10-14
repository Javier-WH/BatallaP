import { Op, Transaction } from 'sequelize';
import {
  ThematicComponent,
  ThematicContent,
  ExpectedLearning,
  ExpectedLearningContent,
} from '@/models/index';

interface CopyThematicTreeParams {
  sourcePeriodGradeSubjectId: number;
  targetPeriodGradeSubjectId: number;
  termId: number;
  // Owner of the source tree and owner the copies are assigned to. Content is
  // scoped per (pgs, term, teacher), so both ends are needed.
  sourceTeacherId: number;
  targetTeacherId: number;
  // When provided, only these source components are copied (used by the plan
  // copy to clone just the components referenced by the evaluation items).
  onlyComponentIds?: number[];
  transaction?: Transaction;
}

export interface CopyThematicTreeResult {
  // source id -> target id, including rows that already existed (title match)
  componentIdMap: Map<number, number>;
  contentIdMap: Map<number, number>;
  createdComponents: number;
  createdContents: number;
  createdLearnings: number;
  skippedComponents: number;
  skippedContents: number;
}

const norm = (value: string | null | undefined): string =>
  (value || '').trim().replace(/\s+/g, ' ').toLowerCase();

export interface ThematicIdMaps {
  componentIdMap: Map<number, number>;
  contentIdMap: Map<number, number>;
}

/**
 * Read-only remap of source component/content ids to target ids by title.
 * Used when copying evaluation plans across grades: if the teacher already
 * cloned the content tree, the plan items keep their thematic links pointing
 * at the target copies; unmatched ids map to nothing (links are dropped).
 */
export const mapThematicIdsByTitle = async (
  sourcePeriodGradeSubjectId: number,
  targetPeriodGradeSubjectId: number,
  termId: number,
  sourceTeacherId: number,
  targetTeacherId: number,
  transaction?: Transaction,
): Promise<ThematicIdMaps> => {
  const tOpts = transaction ? { transaction } : {};
  const [sourceComponents, targetComponents] = await Promise.all([
    ThematicComponent.findAll({
      where: { periodGradeSubjectId: sourcePeriodGradeSubjectId, termId, teacherId: sourceTeacherId },
      include: [{ association: 'contents' }],
      ...tOpts,
    }),
    ThematicComponent.findAll({
      where: { periodGradeSubjectId: targetPeriodGradeSubjectId, termId, teacherId: targetTeacherId },
      include: [{ association: 'contents' }],
      ...tOpts,
    }),
  ]);

  const targetCompByTitle = new Map<string, ThematicComponent>();
  for (const comp of targetComponents) {
    const key = norm(comp.title);
    if (!targetCompByTitle.has(key)) targetCompByTitle.set(key, comp);
  }

  const componentIdMap = new Map<number, number>();
  const contentIdMap = new Map<number, number>();
  for (const sourceComp of sourceComponents) {
    const targetComp = targetCompByTitle.get(norm(sourceComp.title));
    if (!targetComp) continue;
    componentIdMap.set(sourceComp.id, targetComp.id);

    const targetContentByTitle = new Map<string, number>();
    for (const content of ((targetComp as any).contents || []) as ThematicContent[]) {
      const key = norm(content.title);
      if (!targetContentByTitle.has(key)) targetContentByTitle.set(key, content.id);
    }
    for (const sourceContent of ((sourceComp as any).contents || []) as ThematicContent[]) {
      const targetContentId = targetContentByTitle.get(norm(sourceContent.title));
      if (targetContentId !== undefined) contentIdMap.set(sourceContent.id, targetContentId);
    }
  }

  return { componentIdMap, contentIdMap };
};

/**
 * Additively copies a thematic tree (components -> contents -> learnings) from
 * one PeriodGradeSubject to another — used for group subjects taught across
 * grades (e.g. Artes Gráficas in 1ro/2do). Existing target components/contents
 * with the same title are reused (mapped, not duplicated); learnings are
 * cloned only onto target contents that lack a learning with that description.
 */
export const copyThematicTree = async (params: CopyThematicTreeParams): Promise<CopyThematicTreeResult> => {
  const {
    sourcePeriodGradeSubjectId,
    targetPeriodGradeSubjectId,
    termId,
    sourceTeacherId,
    targetTeacherId,
    onlyComponentIds,
    transaction,
  } = params;
  const tOpts = transaction ? { transaction } : {};

  const sourceWhere: any = {
    periodGradeSubjectId: sourcePeriodGradeSubjectId,
    termId,
    teacherId: sourceTeacherId,
  };
  if (onlyComponentIds && onlyComponentIds.length > 0) {
    sourceWhere.id = { [Op.in]: onlyComponentIds };
  }

  const [sourceComponents, targetComponents] = await Promise.all([
    ThematicComponent.findAll({
      where: sourceWhere,
      include: [
        {
          association: 'contents',
          include: [{ association: 'learnings' }],
        },
      ],
      order: [['order', 'ASC'], ['id', 'ASC']],
      ...tOpts,
    }),
    ThematicComponent.findAll({
      where: {
        periodGradeSubjectId: targetPeriodGradeSubjectId,
        termId,
        teacherId: targetTeacherId,
      },
      include: [
        {
          association: 'contents',
          include: [{ association: 'learnings' }],
        },
      ],
      order: [['order', 'ASC'], ['id', 'ASC']],
      ...tOpts,
    }),
  ]);

  const componentIdMap = new Map<number, number>();
  const contentIdMap = new Map<number, number>();
  let createdComponents = 0;
  let createdContents = 0;
  let createdLearnings = 0;
  let skippedComponents = 0;
  let skippedContents = 0;

  const targetCompByTitle = new Map<string, ThematicComponent>();
  for (const comp of targetComponents) {
    const key = norm(comp.title);
    if (!targetCompByTitle.has(key)) targetCompByTitle.set(key, comp);
  }

  let nextComponentOrder =
    (await ThematicComponent.max('order', {
      where: {
        periodGradeSubjectId: targetPeriodGradeSubjectId,
        termId,
        teacherId: targetTeacherId,
      },
      ...tOpts,
    }) as number | null) ?? 0;
  nextComponentOrder += 1;

  // learnings already linked to each target content, by normalized description
  const learningDescByContent = new Map<number, Set<string>>();
  const noteLearning = (contentId: number, description: string) => {
    let set = learningDescByContent.get(contentId);
    if (!set) {
      set = new Set();
      learningDescByContent.set(contentId, set);
    }
    set.add(norm(description));
  };
  for (const comp of targetComponents) {
    for (const content of (comp as any).contents || []) {
      for (const learning of content.learnings || []) {
        noteLearning(content.id, learning.description);
      }
    }
  }

  let nextLearningOrder = ((await ExpectedLearning.max('order', tOpts)) as number | null) ?? 0;

  // A learning may link several contents — collect them by learning id first so
  // each one is cloned once and linked to every mapped target content missing it.
  const sourceLearnings = new Map<number, { learning: ExpectedLearning; sourceContentIds: Set<number> }>();

  for (const sourceComp of sourceComponents) {
    let targetComp = targetCompByTitle.get(norm(sourceComp.title));
    if (targetComp) {
      skippedComponents++;
    } else {
      targetComp = await ThematicComponent.create(
        {
          periodGradeSubjectId: targetPeriodGradeSubjectId,
          termId,
          teacherId: targetTeacherId,
          title: sourceComp.title,
          order: nextComponentOrder++,
        },
        tOpts,
      );
      createdComponents++;
      targetCompByTitle.set(norm(sourceComp.title), targetComp);
    }
    componentIdMap.set(sourceComp.id, targetComp.id);

    const targetContents = await ThematicContent.findAll({
      where: { thematicComponentId: targetComp.id },
      order: [['order', 'ASC'], ['id', 'ASC']],
      ...tOpts,
    });
    const targetContentByTitle = new Map<string, ThematicContent>();
    let nextContentOrder = 0;
    for (const content of targetContents) {
      const key = norm(content.title);
      if (!targetContentByTitle.has(key)) targetContentByTitle.set(key, content);
      nextContentOrder = Math.max(nextContentOrder, content.order);
    }
    nextContentOrder += 1;

    const sourceContents = ((sourceComp as any).contents || []) as ThematicContent[];
    for (const sourceContent of sourceContents) {
      let targetContent = targetContentByTitle.get(norm(sourceContent.title));
      if (targetContent) {
        skippedContents++;
      } else {
        targetContent = await ThematicContent.create(
          {
            thematicComponentId: targetComp.id,
            title: sourceContent.title,
            order: nextContentOrder++,
          },
          tOpts,
        );
        createdContents++;
        targetContentByTitle.set(norm(sourceContent.title), targetContent);
      }
      contentIdMap.set(sourceContent.id, targetContent.id);

      for (const learning of ((sourceContent as any).learnings || []) as ExpectedLearning[]) {
        let entry = sourceLearnings.get(learning.id);
        if (!entry) {
          entry = { learning, sourceContentIds: new Set() };
          sourceLearnings.set(learning.id, entry);
        }
        entry.sourceContentIds.add(sourceContent.id);
      }
    }
  }

  for (const { learning, sourceContentIds } of sourceLearnings.values()) {
    const missingContentIds = [...sourceContentIds]
      .map((id) => contentIdMap.get(id))
      .filter((id): id is number => id !== undefined)
      .filter((id) => !learningDescByContent.get(id)?.has(norm(learning.description)));
    if (missingContentIds.length === 0) continue;

    const clone = await ExpectedLearning.create(
      { description: learning.description, order: ++nextLearningOrder },
      tOpts,
    );
    await ExpectedLearningContent.bulkCreate(
      missingContentIds.map((contentId) => ({ learningId: clone.id, contentId })),
      tOpts,
    );
    createdLearnings++;
    for (const contentId of missingContentIds) noteLearning(contentId, learning.description);
  }

  return {
    componentIdMap,
    contentIdMap,
    createdComponents,
    createdContents,
    createdLearnings,
    skippedComponents,
    skippedContents,
  };
};
