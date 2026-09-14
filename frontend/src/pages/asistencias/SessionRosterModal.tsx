import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, Table, Button, Space, Tag, Tooltip, Select, Input, message, Alert,
} from 'antd';
import { CheckOutlined, CloseOutlined, ClockCircleOutlined, StopOutlined, UnlockOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '@/services/api';
import type { RosterEntry, AttendanceStatus, ClearanceReason } from './types';
import { STATUS_LABELS, STATUS_COLORS } from './types';

interface SessionRosterModalProps {
  open: boolean;
  sessionId: number | null;
  sessionTitle: string;
  canEdit: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

/**
 * Roster editor for one attendance session. Used by the teacher tab (own
 * sessions) and the staff tab (any session, when canEdit).
 */
const SessionRosterModal: React.FC<SessionRosterModalProps> = ({
  open, sessionId, sessionTitle, canEdit, onClose, onSaved,
}) => {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reasons, setReasons] = useState<ClearanceReason[]>([]);
  const [clearing, setClearing] = useState<RosterEntry | null>(null);
  const [clearCode, setClearCode] = useState<string | null>(null);
  const [clearNote, setClearNote] = useState('');

  const fetchData = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const [rosterRes, reasonsRes] = await Promise.all([
        api.get(`/attendance/sessions/${sessionId}`),
        api.get('/attendance/clearance-reasons'),
      ]);
      setRoster(rosterRes.data.roster ?? []);
      setReasons(reasonsRes.data ?? []);
    } catch {
      message.error('Error al cargar la nómina');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (open) {
      fetchData();
      setClearing(null);
      setClearCode(null);
      setClearNote('');
    }
  }, [open, fetchData]);

  const setStatus = (inscriptionId: number, status: AttendanceStatus | null) => {
    setRoster(prev => prev.map(r => {
      if (r.inscriptionId !== inscriptionId) return r;
      const requiresReason = status === 'absent' || status === 'kicked';
      return {
        ...r,
        status,
        reason: requiresReason ? (r.reason ?? '') : null,
      };
    }));
  };

  const setReason = (inscriptionId: number, reason: string) => {
    setRoster(prev => prev.map(r => (r.inscriptionId === inscriptionId ? { ...r, reason } : r)));
  };

  const handleSave = async () => {
    if (!sessionId) return;
    const missingReason = roster.find(
      r => (r.status === 'absent' || r.status === 'kicked') && !(r.reason ?? '').trim()
    );
    if (missingReason) {
      message.warning(`Indique el motivo de ${missingReason.status === 'absent' ? 'ausencia' : 'expulsión'} de ${missingReason.fullName}`);
      return;
    }
    setSaving(true);
    try {
      const records = roster
        .filter(r => r.status !== null)
        .map(r => ({ inscriptionId: r.inscriptionId, status: r.status, reason: r.reason || null }));
      await api.put(`/attendance/sessions/${sessionId}/records`, { records });
      message.success('Asistencia guardada');
      onSaved?.();
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al guardar asistencia');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!clearing || !clearCode) return;
    const reason = reasons.find(r => r.code === clearCode);
    if (reason?.requiresNote && !clearNote.trim()) {
      message.warning('Especifique el motivo');
      return;
    }
    try {
      await api.post(`/attendance/records/${clearing.recordId}/clear`, {
        reasonCode: clearCode,
        reasonNote: clearNote.trim() || null,
      });
      message.success('Estudiante desbloqueado');
      setClearing(null);
      setClearCode(null);
      setClearNote('');
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al desbloquear');
    }
  };

  const columns: ColumnsType<RosterEntry> = [
    { title: '#', width: 50, render: (_v, _r, i) => i + 1 },
    { title: 'Estudiante', dataIndex: 'fullName' },
    { title: 'Cédula', dataIndex: 'document', width: 110 },
    {
      title: 'Estado',
      dataIndex: 'status',
      width: 260,
      render: (_v, r) => {
        if (!canEdit) {
          return r.status ? <Tag color={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Tag> : <Tag>—</Tag>;
        }
        return (
          <Space size={4}>
            <Tooltip title="Presente">
              <Button
                size="small"
                type={r.status === 'present' ? 'primary' : 'default'}
                style={r.status === 'present' ? { backgroundColor: '#22a547', borderColor: '#22a547' } : {}}
                icon={<CheckOutlined />}
                onClick={() => setStatus(r.inscriptionId, 'present')}
              />
            </Tooltip>
            <Tooltip title="Ausente">
              <Button
                size="small"
                danger={r.status === 'absent'}
                icon={<CloseOutlined />}
                onClick={() => setStatus(r.inscriptionId, r.status === 'absent' ? null : 'absent')}
              />
            </Tooltip>
            <Tooltip title="Tarde">
              <Button
                size="small"
                icon={<ClockCircleOutlined />}
                type={r.status === 'late' ? 'primary' : 'default'}
                style={r.status === 'late' ? { backgroundColor: '#f59e0b', borderColor: '#f59e0b' } : {}}
                onClick={() => setStatus(r.inscriptionId, r.status === 'late' ? null : 'late')}
              />
            </Tooltip>
            <Tooltip title="Expulsado">
              <Button
                size="small"
                icon={<StopOutlined />}
                danger={r.status === 'kicked'}
                onClick={() => setStatus(r.inscriptionId, r.status === 'kicked' ? null : 'kicked')}
              />
            </Tooltip>
          </Space>
        );
      },
    },
    {
      title: 'Motivo',
      dataIndex: 'reason',
      render: (_v, r) => {
        if (!canEdit) return r.reason ? <span className="text-xs">{r.reason}</span> : null;
        if (r.status === 'absent' || r.status === 'kicked') {
          return (
            <Input
              size="small"
              placeholder="Motivo obligatorio"
              value={r.reason ?? ''}
              onChange={e => setReason(r.inscriptionId, e.target.value)}
            />
          );
        }
        return null;
      },
    },
    {
      title: 'Bloqueo',
      dataIndex: 'blocked',
      width: 220,
      render: (_v, r) => {
        if (!r.blocked) return null;
        return (
          <Space size={4}>
            <Tag color="volcano">Bloqueado</Tag>
            {canEdit && r.recordId && (
              <Button size="small" icon={<UnlockOutlined />} onClick={() => { setClearing(r); setClearCode(null); setClearNote(''); }}>
                Desbloquear
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const selectedReason = reasons.find(r => r.code === clearCode);

  return (
    <Modal
      open={open}
      title={sessionTitle}
      onCancel={onClose}
      width={860}
      footer={
        canEdit ? (
          <Space>
            <Button onClick={onClose}>Cerrar</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>Guardar</Button>
          </Space>
        ) : (
          <Button onClick={onClose}>Cerrar</Button>
        )
      }
    >
      {roster.some(r => r.blocked) && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Hay estudiantes bloqueados por inasistencia en una sesión anterior de hoy. Desbloquee con un motivo para dejar el registro auditable."
        />
      )}
      <Table
        rowKey="inscriptionId"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={roster}
        pagination={false}
        rowClassName={r => (r.blocked ? 'bg-orange-50' : '')}
      />

      <Modal
        open={clearing !== null}
        title={`Desbloquear: ${clearing?.fullName ?? ''}`}
        onCancel={() => setClearing(null)}
        onOk={handleClear}
        okText="Desbloquear"
        okButtonProps={{ disabled: !clearCode }}
        width={440}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Select
            placeholder="Motivo del desbloqueo"
            style={{ width: '100%' }}
            value={clearCode}
            onChange={setClearCode}
            options={reasons.map(r => ({ value: r.code, label: r.label }))}
          />
          {selectedReason?.requiresNote && (
            <Input.TextArea
              placeholder="Especifique el motivo (obligatorio)"
              value={clearNote}
              onChange={e => setClearNote(e.target.value)}
              rows={2}
            />
          )}
        </Space>
      </Modal>
    </Modal>
  );
};

export default SessionRosterModal;
