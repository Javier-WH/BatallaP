import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Spin, message } from 'antd';
import { pdf } from '@react-pdf/renderer';
import EnrollmentReportPDF from './EnrollmentReportPDF';
import { getReportByUuid } from '@/services/enrollmentReportService';
import type { SnapshotData } from '@/services/enrollmentReportService';
import api from '@/services/api';

interface EnrollmentReportModalProps {
  open: boolean;
  uuid: string | null;
  onClose: () => void;
}

const EnrollmentReportModal: React.FC<EnrollmentReportModalProps> = ({ open, uuid, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (!uuid) return;
    setLoading(true);
    setPdfUrl(null);
    try {
      const report = await getReportByUuid(uuid);
      const snapshotData = report.snapshotData as unknown as SnapshotData;

      // Fetch logo as base64
      let logoBase64: string | null = null;
      try {
        const logoRes = await api.get('/upload/logo', { responseType: 'blob' });
        const blob = logoRes.data as Blob;
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch {
        // No logo available
      }

      const doc = (
        <EnrollmentReportPDF
          data={snapshotData}
          uuid={report.uuid}
          createdAt={report.createdAt}
          logoBase64={logoBase64}
        />
      );

      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (error) {
      console.error('Error loading report:', error);
      message.error('Error al cargar el reporte de inscripción');
    } finally {
      setLoading(false);
    }
  }, [uuid]);

  useEffect(() => {
    if (open && uuid) {
      loadReport();
    }
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [open, uuid, loadReport]);

  const handleClose = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title="Planilla de Inscripción"
      width={900}
      footer={null}
      destroyOnClose
      styles={{ body: { padding: 0, height: '75vh' } }}
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '75vh' }}>
          <Spin size="large" tip="Generando PDF..." />
        </div>
      ) : pdfUrl ? (
        <iframe
          src={pdfUrl}
          style={{ width: '100%', height: '75vh', border: 'none' }}
          title="Planilla de Inscripción"
        />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '75vh', color: '#999' }}>
          No se pudo generar el PDF
        </div>
      )}
    </Modal>
  );
};

export default EnrollmentReportModal;
