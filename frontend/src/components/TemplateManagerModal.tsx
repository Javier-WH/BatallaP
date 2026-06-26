import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Upload, Button, Table, Typography, Space, Popconfirm, message, Empty } from 'antd';
import { DeleteOutlined, FileExcelOutlined, InboxOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import api from '@/services/api';

const { Text } = Typography;

export interface TemplateInfo {
  name: string;
  size: number;
  updatedAt: string;
}

export interface TemplateManagerModalProps {
  open: boolean;
  onClose: () => void;
  selectedTemplate?: string | null;
  onSelect: (templateName: string) => void;
}

const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({
  open,
  onClose,
  selectedTemplate,
  onSelect,
}) => {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<TemplateInfo[]>('/templates');
      setTemplates(data);
    } catch (error) {
      console.error('Error fetching templates', error);
      message.error('Error al cargar las plantillas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open, fetchTemplates]);

  const handleDelete = async (name: string) => {
    try {
      await api.delete(`/templates/${encodeURIComponent(name)}`);
      message.success('Plantilla eliminada');
      fetchTemplates();
      if (selectedTemplate === name) {
        onSelect('');
      }
    } catch (error) {
      console.error('Error deleting template', error);
      message.error('Error al eliminar la plantilla');
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    accept: '.xlsx,.xls',
    multiple: false,
    showUploadList: false,
    beforeUpload: (file) => {
      const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
      if (!isExcel) {
        message.error('Solo se permiten archivos Excel (.xlsx, .xls)');
        return Upload.LIST_IGNORE;
      }
      const under10MB = file.size / 1024 / 1024 < 10;
      if (!under10MB) {
        message.error('El archivo supera el límite de 10MB');
        return Upload.LIST_IGNORE;
      }
      setUploading(true);
      return true;
    },
    customRequest: async (options) => {
      const { file, onSuccess, onError } = options;
      const formData = new FormData();
      formData.append('file', file as File);
      try {
        await api.post('/templates', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        onSuccess?.({}, new XMLHttpRequest());
        setUploading(false);
        message.success('Plantilla subida correctamente');
        fetchTemplates();
      } catch (err: any) {
        onError?.(err);
        setUploading(false);
        const msg = err?.response?.data?.message || 'Error al subir la plantilla';
        message.error(msg);
      }
    },
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('es-VE');
    } catch {
      return iso;
    }
  };

  const columns = [
    {
      title: 'Plantilla',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <FileExcelOutlined style={{ color: '#059669' }} />
          <Text>{name}</Text>
        </Space>
      ),
    },
    {
      title: 'Tamaño',
      dataIndex: 'size',
      key: 'size',
      width: 110,
      render: (size: number) => <Text type="secondary">{formatSize(size)}</Text>,
    },
    {
      title: 'Modificada',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (d: string) => <Text type="secondary">{formatDate(d)}</Text>,
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 140,
      render: (_: any, record: TemplateInfo) => (
        <Space>
          <Button
            size="small"
            type={selectedTemplate === record.name ? 'primary' : 'default'}
            onClick={() => onSelect(selectedTemplate === record.name ? '' : record.name)}
          >
            {selectedTemplate === record.name ? 'Seleccionada' : 'Seleccionar'}
          </Button>
          <Popconfirm
            title="¿Eliminar esta plantilla?"
            description="No se puede deshacer."
            onConfirm={() => handleDelete(record.name)}
            okText="Sí, eliminar"
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title="Gestión de plantillas (Resumen de Rendimiento)"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>Cerrar</Button>,
      ]}
      width={720}
    >
      <div style={{ marginBottom: 16 }}>
        <Upload.Dragger {...uploadProps}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: '#059669' }} />
          </p>
          <p className="ant-upload-text">Haz click o arrastra un archivo Excel aquí</p>
          <p className="ant-upload-hint">
            Solo se aceptan archivos .xlsx o .xls (máx 10MB). El nombre se sanitiza automáticamente.
          </p>
        </Upload.Dragger>
        {uploading && <div style={{ marginTop: 8 }}><Text type="secondary">Subiendo…</Text></div>}
      </div>

      {templates.length === 0 && !loading ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No hay plantillas. Sube la primera con el cuadro de arriba."
        />
      ) : (
        <Table
          rowKey="name"
          loading={loading}
          dataSource={templates}
          columns={columns}
          pagination={false}
          size="small"
          locale={{ emptyText: 'No hay plantillas' }}
        />
      )}

      <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
        <Text style={{ color: '#166534', fontSize: 12 }}>
          • El archivo .xlsx debe contener <strong>named ranges</strong> que el backend usa como guía para rellenar los datos.
        </Text><br />
        <Text style={{ color: '#166534', fontSize: 12 }}>
          • Ejemplos de nombres esperados: <code>inst_name</code>, <code>std_doc_1</code>, <code>grade_2_1</code>, <code>subj_3</code>.
        </Text><br />
        <Text style={{ color: '#166534', fontSize: 12 }}>
          • Si la plantilla seleccionada no cubre todas las materías, se agregan columnas adicionales automáticamente.
        </Text>
      </div>
    </Modal>
  );
};

export default TemplateManagerModal;