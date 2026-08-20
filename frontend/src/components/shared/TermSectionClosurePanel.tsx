import React, { useEffect, useState } from 'react';
import { Modal, Table, Tag, Button, Tooltip, Popconfirm, message, Spin, Empty } from 'antd';
import { LockOutlined, UnlockOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import api from '@/services/api';

interface TermSection {
  id: number;
  name: string;
  isBlocked: boolean;
  schoolPeriodId: number;
}

interface StructureSection {
  id: number;
  name: string;
}

// The structure API returns PeriodGrade[] with nested grade + sections
interface StructurePeriodGrade {
  id: number; // PeriodGrade id
  gradeId: number;
  grade: {
    id: number;
    name: string;
    order?: number;
    isDiversified?: boolean;
  };
  sections: StructureSection[];
}

interface TermSectionClosurePanelProps {
  open: boolean;
  onClose: () => void;
  term: TermSection | null;
  structure: StructurePeriodGrade[];
}

interface ClosedEntry {
  sectionId: number;
  gradeId: number;
}

interface ClosureStatus {
  termId: number;
  termGloballyBlocked: boolean;
  closedSections: ClosedEntry[] | null; // null = all closed
}

const TermSectionClosurePanel: React.FC<TermSectionClosurePanelProps> = ({
  open,
  onClose,
  term,
  structure,
}) => {
  const [loading, setLoading] = useState(false);
  const [closureStatus, setClosureStatus] = useState<ClosureStatus | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const fetchClosureStatus = async () => {
    if (!term) return;
    setLoading(true);
    try {
      const res = await api.get(`/terms/${term.id}/section-closures`);
      setClosureStatus(res.data);
    } catch (error) {
      console.error('Error fetching closure status', error);
      message.error('Error al cargar el estado de cierre');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && term) {
      fetchClosureStatus();
    }
  }, [open, term]);

  const isSectionClosed = (sectionId: number, gradeId: number): boolean => {
    if (!closureStatus) return false;
    if (closureStatus.termGloballyBlocked) return true;
    if (closureStatus.closedSections === null) return true;
    return closureStatus.closedSections.some(
      c => c.sectionId === sectionId && c.gradeId === gradeId
    );
  };

  const handleCloseSection = async (sectionId: number, gradeId: number) => {
    if (!term) return;
    const key = `${gradeId}-${sectionId}`;
    setTogglingKey(key);
    try {
      await api.post(`/terms/${term.id}/section-closures`, { sectionId, gradeId });
      message.success('Sección cerrada correctamente');
      await fetchClosureStatus();
    } catch (error) {
      console.error('Error closing section', error);
      message.error('Error al cerrar la sección');
    } finally {
      setTogglingKey(null);
    }
  };

  const handleReopenSection = async (sectionId: number, gradeId: number) => {
    if (!term) return;
    const key = `${gradeId}-${sectionId}`;
    setTogglingKey(key);
    try {
      await api.delete(`/terms/${term.id}/section-closures/${sectionId}/${gradeId}`);
      message.success('Sección reabierta correctamente');
      await fetchClosureStatus();
    } catch (error) {
      console.error('Error reopening section', error);
      message.error('Error al reabrir la sección');
    } finally {
      setTogglingKey(null);
    }
  };

  // Build flat list of sections with grade info (sorted by grade order)
  const sortedStructure = [...structure].sort((a, b) => {
    const orderA = a.grade?.order ?? 0;
    const orderB = b.grade?.order ?? 0;
    return orderA - orderB;
  });

  const sectionsData = sortedStructure.flatMap(pg =>
    (pg.sections || [])
      .filter(s => !s.name.toLowerCase().includes('materia pendiente'))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map(section => ({
        key: `${pg.gradeId}-${section.id}`,
        gradeId: pg.gradeId,
        gradeName: pg.grade?.name || `Grado ${pg.gradeId}`,
        sectionId: section.id,
        sectionName: section.name,
      }))
  );

  const columns = [
    {
      title: 'Grado',
      dataIndex: 'gradeName',
      key: 'gradeName',
      width: 200,
      render: (text: string) => <span style={{ fontWeight: 700 }}>{text}</span>,
    },
    {
      title: 'Sección',
      dataIndex: 'sectionName',
      key: 'sectionName',
      render: (text: string) => (
        <span style={{ fontWeight: 600 }}>
          Sección {text.replace(/sección/gi, '').trim()}
        </span>
      ),
    },
    {
      title: 'Estado',
      key: 'status',
      width: 140,
      align: 'center' as const,
      render: (_: any, record: any) => {
        const closed = isSectionClosed(record.sectionId, record.gradeId);
        return (
          <Tag
            icon={closed ? <LockOutlined /> : <UnlockOutlined />}
            color={closed ? 'error' : 'success'}
            style={{ borderRadius: 20, padding: '2px 12px', fontWeight: 700, textTransform: 'uppercase', fontSize: 10, border: 'none' }}
          >
            {closed ? 'Cerrado' : 'Abierto'}
          </Tag>
        );
      },
    },
    {
      title: 'Acción',
      key: 'action',
      width: 100,
      align: 'center' as const,
      render: (_: any, record: any) => {
        const closed = isSectionClosed(record.sectionId, record.gradeId);
        const globallyBlocked = closureStatus?.termGloballyBlocked;
        const rowKey = `${record.gradeId}-${record.sectionId}`;

        if (globallyBlocked) {
          return (
            <Tooltip title="El lapso está bloqueado globalmente. Todas las secciones están cerradas.">
              <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                <ExclamationCircleOutlined /> Bloqueo global
              </span>
            </Tooltip>
          );
        }

        return (
          <Popconfirm
            title={`¿${closed ? 'Reabrir' : 'Cerrar'} esta sección?`}
            onConfirm={() => closed ? handleReopenSection(record.sectionId, record.gradeId) : handleCloseSection(record.sectionId, record.gradeId)}
          >
            <Button
              type="link"
              loading={togglingKey === rowKey}
              icon={closed
                ? <LockOutlined style={{ color: '#faad14' }} />
                : <UnlockOutlined style={{ color: '#52c41a' }} />}
            />
          </Popconfirm>
        );
      },
    },
  ];

  const closedCount = closureStatus?.termGloballyBlocked
    ? sectionsData.length
    : (closureStatus?.closedSections?.length ?? 0);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
      title={
        <div>
          <span style={{ fontWeight: 800 }}>Cerrar Lapso por Sección</span>
          {term && (
            <span style={{ marginLeft: 12, color: '#8c8c8c', fontWeight: 600, fontSize: 14 }}>
              {term.name}
            </span>
          )}
        </div>
      }
    >
      {closureStatus?.termGloballyBlocked && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fff7e6', borderRadius: 8, border: '1px solid #ffd591' }}>
          <span style={{ color: '#d46b08', fontWeight: 600, fontSize: 13 }}>
            <ExclamationCircleOutlined /> Este lapso está bloqueado globalmente. Todas las secciones están cerradas.
            Para gestionar cierres individuales, primero desbloquee el lapso.
          </span>
        </div>
      )}

      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, color: '#595959' }}>
          Secciones cerradas: <strong>{closedCount}</strong> / {sectionsData.length}
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : sectionsData.length === 0 ? (
        <Empty description="No hay secciones configuradas para este período" />
      ) : (
        <Table
          dataSource={sectionsData}
          columns={columns}
          pagination={false}
          size="small"
          scroll={{ y: 400 }}
          bordered
        />
      )}
    </Modal>
  );
};

export default TermSectionClosurePanel;
