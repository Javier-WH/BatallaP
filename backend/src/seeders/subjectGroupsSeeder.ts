import sequelize from '@/config/database';
import { SubjectGroup, Subject } from '@/models/index';

const GROUP_NAME = 'Participación en Grupos de Creación, Recreación y Producción';
const SUBJECTS_IN_GROUP = ['Artes Gráficas', 'Ortografía', 'Agrupación de Desfiles'];

const seedSubjectGroups = async () => {
  const transaction = await sequelize.transaction();
  try {
    const [group] = await SubjectGroup.findOrCreate({
      where: { name: GROUP_NAME },
      defaults: { name: GROUP_NAME },
      transaction
    });

    for (const subjectName of SUBJECTS_IN_GROUP) {
      const [subject] = await Subject.findOrCreate({
        where: { name: subjectName },
        defaults: { name: subjectName },
        transaction
      });

      if (subject.subjectGroupId !== group.id) {
        subject.subjectGroupId = group.id;
        await subject.save({ transaction });
      }
    }

    await transaction.commit();
    console.log(`✅ Grupo "${GROUP_NAME}" asignado a ${SUBJECTS_IN_GROUP.length} materias.`);
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error configurando grupos de materias:', error);
    throw error;
  }
};

if (require.main === module) {
  sequelize.authenticate()
    .then(() => seedSubjectGroups())
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export default seedSubjectGroups;
