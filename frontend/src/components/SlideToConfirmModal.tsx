import React, { useEffect, useState } from 'react';
import { Modal, Slider, Button, Typography } from 'antd';
import { ExclamationCircleFilled, CheckCircleFilled } from '@ant-design/icons';

const { Text } = Typography;

interface SlideToConfirmModalProps {
  open: boolean;
  title: string;
  /** What is about to be deleted (item summary). */
  description?: React.ReactNode;
  /** Consequence warning shown below the description. */
  warning?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const SlideToConfirmModal: React.FC<SlideToConfirmModalProps> = ({
  open,
  title,
  description,
  warning,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const [slideValue, setSlideValue] = useState(0);
  const armed = slideValue >= 100;

  // Reset the slider every time the modal opens
  useEffect(() => {
    if (open) setSlideValue(0);
  }, [open]);

  return (
    <Modal
      open={open}
      onCancel={loading ? undefined : onCancel}
      width={440}
      title={
        <span>
          <ExclamationCircleFilled style={{ color: '#f59e0b', marginRight: 8 }} />
          {title}
        </span>
      }
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>,
        <Button key="confirm" type="primary" danger disabled={!armed} loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>,
      ]}
    >
      {description && <div style={{ marginBottom: 12 }}>{description}</div>}
      {warning && (
        <div
          style={{
            marginBottom: 20,
            padding: '10px 12px',
            borderRadius: 8,
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#b91c1c',
            fontSize: 13,
          }}
        >
          {warning}
        </div>
      )}

      <div
        style={{
          padding: '14px 16px 10px',
          borderRadius: 10,
          border: `1px solid ${armed ? '#dc2626' : 'var(--color-border, #d9d9d9)'}`,
          backgroundColor: armed ? 'rgba(220, 38, 38, 0.06)' : 'var(--color-page-bg, #f5f5f5)',
          transition: 'all 0.2s',
        }}
      >
        <Slider
          min={0}
          max={100}
          value={slideValue}
          onChange={(value) => setSlideValue(Array.isArray(value) ? value[0] : value)}
          tooltip={{ open: false }}
          styles={{
            track: { backgroundColor: armed ? '#dc2626' : '#fca5a5' },
            rail: { backgroundColor: 'rgba(0,0,0,0.08)' },
          }}
        />
        <div style={{ textAlign: 'center', marginTop: 2 }}>
          {armed ? (
            <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: 600 }}>
              <CheckCircleFilled style={{ marginRight: 6 }} />
              Ahora puedes confirmar la eliminación
            </Text>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Desliza completamente hacia la derecha para habilitar
            </Text>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default SlideToConfirmModal;
