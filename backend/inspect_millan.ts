import sequelize from './src/config/database';
(async () => {
  const [people]: any[] = await sequelize.query("SELECT id, firstName, lastName, document FROM people WHERE lastName LIKE '%MILLAN%' OR firstName LIKE '%YAMPIERO%'");
  console.table(people);
  for (const p of people) {
    const [pp]: any[] = await sequelize.query(`SELECT * FROM person_planteles WHERE personId = ${p.id} ORDER BY \`order\``);
    const [ins]: any[] = await sequelize.query(`SELECT i.id, i.schoolPeriodId, i.gradeId, i.sectionId, sp.name AS periodName, g.name AS gradeName, s.name AS sectionName FROM inscriptions i LEFT JOIN school_periods sp ON sp.id=i.schoolPeriodId LEFT JOIN grades g ON g.id=i.gradeId LEFT JOIN sections s ON s.id=i.sectionId WHERE i.personId=${p.id} ORDER BY i.schoolPeriodId`);
    const [hg]: any[] = await sequelize.query(`SELECT h.id, h.schoolPeriodId, h.gradeId, h.subjectId, h.finalScore, h.gradeType, h.plantelId, h.subjectName FROM historical_grades h WHERE h.personId=${p.id} ORDER BY h.schoolPeriodId, h.gradeId`);
    console.log('PERSON', p);
    console.log('PERSON PLANTELES'); console.table(pp);
    console.log('INSCRIPTIONS'); console.table(ins);
    console.log('HISTORICAL GRADES'); console.table(hg);
  }
  await sequelize.close();
})().catch(e => { console.error(e); process.exit(1); });
