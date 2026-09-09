import { useEffect, useState, useCallback } from 'react';
import { Card, Table, Button, Tag, Modal, Input, message, Space, Empty, Tooltip } from 'antd';
import { CheckOutlined, CloseOutlined, ReloadOutlined, ClockCircleOutlined } from '@ant-design/icons';
import api from '@/services/api';

interface EditRequest {
  id: number;
  qualificationId: number;
  requestedBy: number;
  justification: string;
  currentScore: number | null;
  requestedScore: number | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  qualification?: {
    id: number;
    score: number;
    remedialScore: number | null;
    evaluationPlan?: { id: number; description: string; percentage: number };
    inscriptionSubject?: {
      subject?: { id: number; name: string };
      inscription?: {
        student?: { id: number; firstName: string; lastName: string; document: string };
      };
    };
  };
  requester?: {
    id: number;
    username: string;
    person?: { firstName: string; lastName: string };
  };
}

const QualificationEditRequests = () => {
  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewingRequest, setReviewingRequest] = useState<EditRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/evaluation/grade-edit-requests/pending');
      setRequests(res.data);
    } catch {
      message.error('Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleOpenReview = (request: EditRequest, action: 'approve' | 'reject') => {
    setReviewingRequest(request);
    setReviewAction(action);
    setReviewNote('');
    setReviewModalOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!reviewingRequest) return;
    setSubmitting(true);
    try {
      await api.put(`/evaluation/grade-edit-request/${reviewingRequest.id}/review`, {
        action: reviewAction,
        reviewNote: reviewNote.trim() || null,
      });
      message.success(reviewAction === 'approve' ? 'Solicitud aprobada' : 'Solicitud rechazada');
      setReviewModalOpen(false);
      setReviewingRequest(null);
      fetchRequests();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al procesar solicitud';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'Estudiante',
      key: 'student',
      render: (_: unknown, r: EditRequest) => {
        const student = r.qualification?.inscriptionSubject?.inscription?.student;
        return student ? `${student.firstName} ${student.lastName}` : '—';
      },
    },
    {
      title: 'Materia',
      key: 'subject',
      render: (_: unknown, r: EditRequest) => r.qualification?.inscriptionSubject?.subject?.name || '—',
    },
    {
      title: 'Evaluación',
      key: 'evaluation',
      render: (_: unknown, r: EditRequest) => r.qualification?.evaluationPlan?.description || '—',
    },
    {
      title: 'Nota actual',
      key: 'score',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, r: EditRequest) => {
        const current = r.currentScore != null ? r.currentScore : r.qualification?.score;
        return current != null ? current : '—';
      },
    },
    {
      title: 'Nota propuesta',
      key: 'requestedScore',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, r: EditRequest) => {
        if (r.requestedScore == null) return '—';
        const current = r.currentScore != null ? r.currentScore : r.qualification?.score;
        const isChange = current != null && r.requestedScore !== current;
        return (
          <Tag color={isChange ? 'orange' : 'default'}>
            {r.requestedScore}
          </Tag>
        );
      },
    },
    {
      title: 'Solicitado por',
      key: 'requester',
      render: (_: unknown, r: EditRequest) => {
        const person = r.requester?.person;
        return person ? `${person.firstName} ${person.lastName}` : r.requester?.username || '—';
      },
    },
    {
      title: 'Justificación',
      key: 'justification',
      ellipsis: true,
      render: (_: unknown, r: EditRequest) => (
        <Tooltip title={r.justification}>
          <span>{r.justification}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Fecha',
      key: 'createdAt',
      width: 140,
      render: (_: unknown, r: EditRequest) => new Date(r.createdAt).toLocaleString('es-VE'),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 160,
      render: (_: unknown, r: EditRequest) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleOpenReview(r, 'approve')}
          >
            Aprobar
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseOutlined />}
            onClick={() => handleOpenReview(r, 'reject')}
          >
            Rechazar
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <ClockCircleOutlined />
            <span>Solicitudes de edición de notas pendientes</span>
          </Space>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchRequests} loading={loading}>
            Actualizar
          </Button>
        }
      >
        {requests.length === 0 && !loading ? (
          <Empty description="No hay solicitudes pendientes" />
        ) : (
          <Table
            dataSource={requests}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={false}
            size="middle"
          />
        )}
      </Card>

      <Modal
        title={reviewAction === 'approve' ? 'Aprobar solicitud' : 'Rechazar solicitud'}
        open={reviewModalOpen}
        onCancel={() => setReviewModalOpen(false)}
        onOk={handleSubmitReview}
        okText={reviewAction === 'approve' ? 'Aprobar' : 'Rechazar'}
        cancelText="Cancelar"
        confirmLoading={submitting}
        okButtonProps={reviewAction === 'reject' ? { danger: true } : {}}
      >
        {reviewingRequest && (
          <div style={{ marginBottom: 16 }}>
            <p>
              <strong>Estudiante:</strong>{' '}
              {reviewingRequest.qualification?.inscriptionSubject?.inscription?.student
                ? `${reviewingRequest.qualification.inscriptionSubject.inscription.student.firstName} ${reviewingRequest.qualification.inscriptionSubject.inscription.student.lastName}`
                : '—'}
            </p>
            <p>
              <strong>Materia:</strong> {reviewingRequest.qualification?.inscriptionSubject?.subject?.name || '—'}
            </p>
            <p>
              <strong>Evaluación:</strong> {reviewingRequest.qualification?.evaluationPlan?.description || '—'}
            </p>
            <div style={{ display: 'flex', gap: 24, margin: '12px 0' }}>
              <div>
                <strong>Nota actual:</strong>{' '}
                <Tag>{reviewingRequest.currentScore != null ? reviewingRequest.currentScore : reviewingRequest.qualification?.score ?? '—'}</Tag>
              </div>
              <div>
                <strong>Nota propuesta:</strong>{' '}
                <Tag color="orange">{reviewingRequest.requestedScore ?? '—'}</Tag>
              </div>
            </div>
            <p>
              <strong>Justificación del profesor:</strong> {reviewingRequest.justification}
            </p>
            {reviewAction === 'approve' && (
              <p style={{ color: '#16a34a' }}>
                Al aprobar, la nota se cambiará automáticamente de {reviewingRequest.currentScore ?? reviewingRequest.qualification?.score} a {reviewingRequest.requestedScore} y se registrará en auditoría.
              </p>
            )}
          </div>
        )}
        <Input.TextArea
          placeholder="Nota de revisión (opcional)..."
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          rows={3}
          maxLength={500}
        />
      </Modal>
    </div>
  );
};

export default QualificationEditRequests;
