import { Transaction } from 'sequelize';
import { findOrCreateGuardianProfile, GuardianProfilePayload } from '@/services/guardianProfileService';
import StudentGuardian, { GuardianRelationship } from '@/models/StudentGuardian';

export type GuardianAssignment = {
  payload: GuardianProfilePayload;
  relationship: GuardianRelationship;
  isRepresentative: boolean;
};

export const assignGuardians = async (
  studentId: number,
  assignments: GuardianAssignment[],
  transaction: Transaction
) => {
  await StudentGuardian.destroy({ where: { studentId }, transaction });

  for (const assignment of assignments) {
    const profile = await findOrCreateGuardianProfile(assignment.payload, { transaction });
    await StudentGuardian.create(
      {
        studentId,
        guardianId: profile.id,
        relationship: assignment.relationship,
        isRepresentative: assignment.isRepresentative
      },
      { transaction }
    );
  }
};
