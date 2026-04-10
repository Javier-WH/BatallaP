import api from './api';

export interface GradeEditPermission {
  id: number;
  schoolPeriodId: number | null;
  grantedBy: number;
  grantedTo: number;
  actCode: string;
  observations: string;
  isActive: boolean;
  grantedAt: string;
  revokedAt: string | null;
  revokedBy: number | null;
  schoolPeriod?: {
    id: number;
    name: string;
    period: string;
  };
  granter?: {
    id: number;
    person?: {
      firstName: string;
      lastName: string;
    };
  };
  recipient?: {
    id: number;
    person?: {
      firstName: string;
      lastName: string;
    };
  };
  revoker?: {
    id: number;
    person?: {
      firstName: string;
      lastName: string;
    };
  };
}

export interface GradeEditAudit {
  id: number;
  subjectFinalGradeId: number;
  permissionId: number;
  editedBy: number;
  previousScore: number | null;
  newScore: number | null;
  previousStatus: 'aprobada' | 'reprobada';
  newStatus: 'aprobada' | 'reprobada';
  reason: string;
  editedAt: string;
  actCode?: string;
  subjectFinalGrade?: {
    inscriptionSubject?: {
      subject?: {
        name: string;
      };
      inscription?: {
        student?: {
          firstName: string;
          lastName: string;
          document: string;
        };
        period?: {
          name: string;
          period: string;
        };
      };
    };
  };
  permission?: {
    id: number;
    actCode: string;
    granter?: {
      person?: {
        firstName: string;
        lastName: string;
      };
    };
    schoolPeriod?: {
      name: string;
    };
  };
  editor?: {
    person?: {
      firstName: string;
      lastName: string;
    };
  };
}

export const gradeEditPermissionService = {
  createPermission: async (data: {
    schoolPeriodId?: number;
    grantedTo: number;
    actCode: string;
    observations: string;
  }) => {
    const response = await api.post('/grade-edit-permissions', data);
    return response.data;
  },

  getPermissions: async () => {
    const response = await api.get('/grade-edit-permissions');
    return response.data;
  },

  revokePermission: async (id: number) => {
    const response = await api.delete(`/grade-edit-permissions/${id}`);
    return response.data;
  },

  checkPermission: async (schoolPeriodId: number) => {
    const response = await api.get(`/grade-edit-permissions/check/${schoolPeriodId}`);
    return response.data;
  },

  getAuditLog: async (params?: { limit?: number; offset?: number }) => {
    const response = await api.get('/grade-edit-permissions/audit', { params });
    return response.data;
  },

  updateFinalGrade: async (id: number, data: {
    finalScore?: number;
    status?: 'aprobada' | 'reprobada';
    reason: string;
    permissionId: number;
  }) => {
    const response = await api.put(`/evaluation/final-grade/${id}`, data);
    return response.data;
  }
};
