import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Spin, message } from 'antd';
import { pdf } from '@react-pdf/renderer';
import EvaluationPlanPDF from './EvaluationPlanPDF';
import type { EvaluationPlanItemData, EvaluationPlanHeaderData } from './EvaluationPlanPDF';
import api from '@/services/api';

interface EvaluationPlanPDFModalProps {
  open: boolean;
  onClose: () => void;
  header: EvaluationPlanHeaderData | null;
  items: EvaluationPlanItemData[];
}

const EvaluationPlanPDFModal: React.FC<EvaluationPlanPDFModalProps> = ({
  open,
  onClose,
  header,
  items,
}) => {
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const generatePDF = useCallback(async () => {
    if (!header || items.length === 0) return;
    setLoading(true);
    setPdfUrl(null);

    try {
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

      let instName = '';
      try {
        const settingRes = await api.get('/settings/institution_name');
        instName = settingRes.data?.value || '';
      } catch {
        // No institution name configured
      }

      const doc = (
        <EvaluationPlanPDF
          header={header}
          items={items}
          logoBase64={logoBase64}
          institutionName={instName}
        />
      );

      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (error) {
      console.error('Error generating evaluation plan PDF:', error);
      message.error('Error al generar el PDF del plan de evaluación');
    } finally {
      setLoading(false);
    }
  }, [header, items]);

  useEffect(() => {
    if (open && header) {
      generatePDF();
    }
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [open, header, generatePDF]);

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
      title="Plan de Evaluación - Vista Previa PDF"
      width={1000}
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
          title="Plan de Evaluación"
        />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '75vh', color: '#999' }}>
          No se pudo generar el PDF
        </div>
      )}
    </Modal>
  );
};

export default EvaluationPlanPDFModal;