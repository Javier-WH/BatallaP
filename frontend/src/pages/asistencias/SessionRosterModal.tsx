import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal, Button, Select, Input, message, Alert, Spin,
} from 'antd';
import {
  CheckOutlined, CloseOutlined, ClockCircleOutlined, StopOutlined, UnlockOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '@/services/api';
import type { RosterEntry, AttendanceStatus, ClearanceReason } from './types';

interface SessionRosterModalProps {
  open: boolean;
  sessionId: number | null;
  sessionTitle: string;
  canEdit: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

/* Design tokens from the approved roster mockup (IBM Plex, warm paper tones). */
const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
.roster-font { font-family: 'IBM Plex Sans', system-ui, sans-serif; }
.roster-mono { font-family: 'IBM Plex Mono', monospace; }
`;
const C = { p: '#1e40af', a: '#b54708', t: '#8a5700', o: '#475467' };

/** "APELLIDOS, NOMBRES" → separate roster columns. */
const splitName = (fullName: string): { last: string; first: string } => {
  const idx = fullName.indexOf(',');
  if (idx === -1) return { last: fullName.trim(), first: '' };
  return { last: fullName.slice(0, idx).trim(), first: fullName.slice(idx + 1).trim() };
};

const STATUS_BTN: { code: AttendanceStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { code: 'present', label: 'Presente', icon: <CheckOutlined />, color: C.p },
  { code: 'absent', label: 'Ausente', icon: <CloseOutlined />, color: C.a },
  { code: 'late', label: 'Tarde', icon: <ClockCircleOutlined />, color: C.t },
  { code: 'kicked', label: 'Otro', icon: <StopOutlined />, color: C.o },
];

const btnStyle = (active: boolean, color: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  height: 34, width: 80, borderRadius: 8, fontSize: 13, fontWeight: 500,
  border: `1px solid ${active ? color : '#e4e7ec'}`,
  background: active ? color : '#ffffff',
  color: active ? '#ffffff' : '#475467',
  cursor: 'pointer',
});

/**
 * Roster editor for one attendance session, styled as a printed roster
 * (nómina): one line per student, section separators, live summary panel.
 * Used by the staff tab (any session, when canEdit).
 */
const SessionRosterModal: React.FC<SessionRosterModalProps> = ({
  open, sessionId, canEdit, onClose, onSaved,
}) => {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
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
      setSessionInfo(rosterRes.data.session ?? null);
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
      const requiresReason = status === 'absent' || status === 'kicked' || status === 'excused';
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

  const markAllPresent = () => {
    setRoster(prev => prev.map(r => ({ ...r, status: 'present' as AttendanceStatus, reason: null })));
  };

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, other: 0, missing: 0 };
    for (const r of roster) {
      if (r.status === 'present') c.present++;
      else if (r.status === 'absent') c.absent++;
      else if (r.status === 'late') c.late++;
      else if (r.status === 'kicked' || r.status === 'excused') c.other++;
      if ((r.status === 'absent' || r.status === 'kicked') && !(r.reason ?? '').trim()) c.missing++;
    }
    return c;
  }, [roster]);

  const pct = roster.length > 0 ? Math.round((100 * (counts.present + counts.late)) / roster.length) : 0;

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

  const selectedReason = reasons.find(r => r.code === clearCode);

  return (
    <Modal
      open={open}
      title={null}
      onCancel={onClose}
      width={1280}
      style={{ top: 20 }}
      styles={{ body: { padding: '28px 32px 24px', background: '#ffffff' } }}
      footer={null}
      closable={false}
    >
      <style>{FONT_IMPORT}</style>
      <div className="roster-font" style={{ display: 'flex', flexDirection: 'column', gap: 20, color: '#1b1f2a' }}>
        {/* Header: materia — sección · fecha · hora */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em' }}>
              Asistencia · {sessionInfo?.scheduleEntry?.subject?.name ?? 'Sin materia'}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, color: '#475467' }}>
              {sessionInfo?.sectionLabel && (
                <>
                  <span style={{ fontWeight: 600, color: '#1b1f2a' }}>{sessionInfo.sectionLabel}</span>
                  <span>·</span>
                </>
              )}
              <span>
                {sessionInfo?.scheduleEntry?.day}{' '}
                {sessionInfo ? dayjs(sessionInfo.sessionDate).format('DD/MM/YYYY') : ''}
              </span>
              {sessionInfo?.periodStart && (
                <>
                  <span>·</span>
                  <span className="roster-mono" style={{ fontSize: 13 }}>
                    {sessionInfo.periodStart}{sessionInfo.periodEnd ? ` – ${sessionInfo.periodEnd}` : ''}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            aria-label="Cerrar"
            onClick={onClose}
            style={{
              width: 44, height: 44, borderRadius: 10, border: '1px solid #d0d5dd',
              background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <CloseOutlined style={{ fontSize: 14, color: '#475467' }} />
          </button>
        </div>

        {/* Summary panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 20px', background: '#f6f5f1', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            {[
              { label: 'PRESENTES', value: counts.present, color: C.p },
              { label: 'AUSENTES', value: counts.absent, color: C.a },
              { label: 'TARDE', value: counts.late, color: C.t },
              { label: 'OTRO', value: counts.other, color: C.o },
              { label: 'SIN MOTIVO', value: counts.missing, color: '#1b1f2a' },
            ].map(item => (
              <div key={item.label} style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: '#475467' }}>{item.label}</span>
                <span className="roster-mono" style={{ fontSize: 28, fontWeight: 500, color: item.color }}>{item.value}</span>
              </div>
            ))}
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: '#475467' }}>ASISTENCIA</span>
              <span className="roster-mono" style={{ fontSize: 28, fontWeight: 500 }}>{pct}%</span>
            </div>
          </div>
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#d0d5dd' }}>
            {roster.length > 0 && (
              <>
                <div style={{ width: `${(100 * counts.present) / roster.length}%`, background: C.p }} />
                <div style={{ width: `${(100 * counts.late) / roster.length}%`, background: '#d9a22b' }} />
                <div style={{ width: `${(100 * counts.absent) / roster.length}%`, background: C.a }} />
                <div style={{ width: `${(100 * counts.other) / roster.length}%`, background: '#667085' }} />
              </>
            )}
          </div>
        </div>

        {roster.some(r => r.blocked) && (
          <Alert
            type="warning"
            showIcon
            message="Hay estudiantes bloqueados por inasistencia en una sesión anterior de hoy. Desbloquee con un motivo para dejar el registro auditable."
          />
        )}

        {/* Roster table */}
        <div style={{ flexGrow: 1, border: '1px solid #d0d5dd', borderRadius: 12, overflow: 'auto', maxHeight: 'calc(100dvh - 420px)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', height: 40, background: '#f6f5f1',
            borderBottom: '1px solid #d0d5dd', fontSize: 12, fontWeight: 600,
            letterSpacing: '0.06em', color: '#475467', minWidth: 1150,
            position: 'sticky', top: 0, zIndex: 1,
          }}>
            <div style={{ width: 52, flexShrink: 0, paddingLeft: 16, boxSizing: 'border-box' }}>#</div>
            <div style={{ width: 110, flexShrink: 0 }}>CÉDULA</div>
            <div style={{ width: 210, flexShrink: 0 }}>APELLIDOS</div>
            <div style={{ width: 200, flexShrink: 0 }}>NOMBRES</div>
            <div style={{ width: 130, flexShrink: 0 }}>GRADO/SECCIÓN</div>
            <div style={{ width: 350, flexShrink: 0 }}>ESTADO</div>
            <div style={{ flexGrow: 1, minWidth: 140 }}>MOTIVO</div>
            <div style={{ width: 130, flexShrink: 0 }}>BLOQUEO</div>
          </div>

          <div>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}><Spin /></div>
            ) : roster.length === 0 ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: '#98a2b3', fontSize: 14 }}>Sin estudiantes en esta sesión</div>
            ) : roster.map((r, i) => {
              const { last, first } = splitName(r.fullName);
              const needsReason = (r.status === 'absent' || r.status === 'kicked') && !(r.reason ?? '').trim();
              const sectionChanged = i > 0 && roster[i - 1].sectionLabel !== r.sectionLabel;
              return (
                <div
                  key={r.inscriptionId}
                  style={{
                    display: 'flex', alignItems: 'center', minHeight: 46, minWidth: 1150,
                    borderTop: i === 0 ? 'none' : sectionChanged ? '2px solid #98a2b3' : '1px solid #eaecf0',
                    background: needsReason ? '#fff7ed' : '#ffffff',
                  }}
                >
                  <div className="roster-mono" style={{ width: 52, flexShrink: 0, paddingLeft: 16, boxSizing: 'border-box', fontSize: 13, color: '#475467' }}>{i + 1}</div>
                  <div className="roster-mono" style={{ width: 110, flexShrink: 0, fontSize: 14 }}>{r.document}</div>
                  <div style={{ width: 210, flexShrink: 0, fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={last}>{last}</div>
                  <div style={{ width: 200, flexShrink: 0, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={first}>{first}</div>
                  <div style={{ width: 130, flexShrink: 0 }}>
                    <span style={{
                      display: 'inline-block', minWidth: 24, textAlign: 'center', padding: '2px 8px',
                      borderRadius: 6, background: '#e8ebf5', color: '#1e2a63', fontSize: 12, fontWeight: 600,
                    }}>
                      {r.sectionLabel || '—'}
                    </span>
                  </div>
                  <div style={{ width: 350, flexShrink: 0, display: 'flex', gap: 4 }}>
                    {canEdit ? STATUS_BTN.map(b => {
                      const active = b.code === 'kicked'
                        ? (r.status === 'kicked' || r.status === 'excused')
                        : r.status === b.code;
                      return (
                        <button
                          key={b.code}
                          onClick={() => setStatus(r.inscriptionId, active && b.code !== 'present' ? null : b.code)}
                          style={btnStyle(active, b.color)}
                        >
                          {b.icon}{b.label}
                        </button>
                      );
                    }) : (
                      <span style={{ fontSize: 13, color: '#475467' }}>
                        {r.status ? STATUS_BTN.find(b => b.code === r.status)?.label ?? (r.status === 'excused' ? 'Justificado' : r.status) : 'Sin registrar'}
                      </span>
                    )}
                  </div>
                  <div style={{ flexGrow: 1, minWidth: 140, fontSize: 14, paddingRight: 16 }}>
                    {(r.status === 'absent' || r.status === 'kicked' || r.status === 'excused') ? (
                      canEdit ? (
                        <Input
                          size="small"
                          placeholder="Motivo obligatorio"
                          value={r.reason ?? ''}
                          status={needsReason ? 'warning' : ''}
                          onChange={e => setReason(r.inscriptionId, e.target.value)}
                        />
                      ) : r.reason ? (
                        <span>{r.reason}</span>
                      ) : needsReason ? (
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', border: '1px dashed #b54708',
                          borderRadius: 6, color: '#b54708', fontSize: 13, fontWeight: 500,
                        }}>
                          Motivo obligatorio
                        </span>
                      ) : null
                    ) : null}
                  </div>
                  <div style={{ width: 130, flexShrink: 0, paddingRight: 12 }}>
                    {r.blocked && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 6,
                          background: '#fef0c7', color: '#b54708', fontSize: 12, fontWeight: 600,
                        }}>
                          Bloqueado
                        </span>
                        {canEdit && r.recordId && (
                          <Button size="small" type="text" icon={<UnlockOutlined />} onClick={() => { setClearing(r); setClearCode(null); setClearNote(''); }} />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {canEdit ? (
            <button
              onClick={markAllPresent}
              style={{
                height: 44, padding: '0 18px', borderRadius: 10, border: '1px solid #d0d5dd',
                background: '#ffffff', color: '#1b1f2a', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}
            >
              Marcar todos presentes
            </button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {counts.missing > 0 && (
              <span style={{ fontSize: 13, color: '#475467', marginRight: 8 }}>
                {counts.missing} ausencia{counts.missing === 1 ? '' : 's'} sin motivo
              </span>
            )}
            <button
              onClick={onClose}
              style={{
                height: 44, padding: '0 22px', borderRadius: 10, border: '1px solid #d0d5dd',
                background: '#f6f5f1', color: '#1b1f2a', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
            {canEdit && (
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  height: 44, padding: '0 26px', borderRadius: 10, border: 0,
                  background: '#1e40af', color: '#ffffff', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={clearing !== null}
        title={`Desbloquear: ${clearing?.fullName ?? ''}`}
        onCancel={() => setClearing(null)}
        onOk={handleClear}
        okText="Desbloquear"
        okButtonProps={{ disabled: !clearCode }}
        width={440}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
        </div>
      </Modal>
    </Modal>
  );
};

export default SessionRosterModal;
