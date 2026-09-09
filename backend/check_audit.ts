import sequelize from './src/config/database';

(async () => {
  try {
    await sequelize.authenticate();
    // Get the qualification from request 4
    const [reqs] = await sequelize.query("SELECT id, qualificationId, currentScore, requestedScore, status FROM qualification_edit_requests WHERE id = 4") as any;
    console.log('Request 4:');
    console.table(reqs);

    const qualId = reqs[0].qualificationId;
    const [quals] = await sequelize.query(`SELECT id, score, isAbsent, scoreSetAt FROM qualifications WHERE id = ${qualId}`) as any;
    console.log('Qualification:');
    console.table(quals);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
