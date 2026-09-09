import sequelize from './src/config/database';

(async () => {
  try {
    await sequelize.authenticate();
    // Check if there are multiple qualifications for the same evaluationPlanId + inscriptionSubjectId with different termIds
    const [rows] = await sequelize.query(`
      SELECT evaluationPlanId, inscriptionSubjectId, termId, COUNT(*) as cnt, GROUP_CONCAT(id) as ids
      FROM qualifications
      GROUP BY evaluationPlanId, inscriptionSubjectId
      HAVING cnt > 1
      ORDER BY cnt DESC
      LIMIT 10
    `) as any;
    console.log('Qualifications with same plan+inscriptionSubject but multiple terms:');
    console.table(rows);

    // Check specifically the qualification that was just updated (id=41513)
    const [q41513] = await sequelize.query("SELECT id, evaluationPlanId, inscriptionSubjectId, termId, score, isAbsent FROM qualifications WHERE id = 41513") as any;
    console.log('Qualification 41513:');
    console.table(q41513);

    // Check all qualifications for the same evaluationPlanId + inscriptionSubjectId
    if (q41513.length > 0) {
      const epId = q41513[0].evaluationPlanId;
      const isId = q41513[0].inscriptionSubjectId;
      const [allQ] = await sequelize.query(`SELECT id, termId, score, isAbsent FROM qualifications WHERE evaluationPlanId = ${epId} AND inscriptionSubjectId = ${isId}`) as any;
      console.log(`All qualifications for evaluationPlanId=${epId}, inscriptionSubjectId=${isId}:`);
      console.table(allQ);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
