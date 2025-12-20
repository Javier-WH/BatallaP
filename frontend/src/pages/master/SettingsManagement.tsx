/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, Space, message, Divider, Spin, Upload } from 'antd';
import { SettingOutlined, SaveOutlined, UploadOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Title, Text } = Typography;

interface SettingsFormValues {
  institution_name?: string;
  institution_logo?: string;
}

const SettingsManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>('');

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await api.get('/settings');
        form.setFieldsValue({
          institution_name: res.data.institution_name || '',
          institution_logo: res.data.institution_logo || '',
        });

        try {
          const logoResponse = await api.get('/upload/logo', { responseType: 'blob' });
          const logoUrl = URL.createObjectURL(logoResponse.data);
          setLogoPreview(logoUrl);
        } catch {
          console.log('No logo found, that\'s ok');
        }
      } catch (error) {
        console.error('Error fetching settings', error);
        message.error('Error al cargar configuraciones');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [form]);

  const onFinish = async (values: SettingsFormValues) => {
    setSaving(true);
    try {
      const { institution_logo, ...payload } = values;

      await api.post('/settings', { settings: payload });
      message.success('Configuraciones guardadas correctamente');
    } catch (error) {
      console.error('Error saving settings', error);
      message.error('Error al guardar configuraciones');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" tip="Cargando configuración..." /></div>;

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Title level={2}>
        <SettingOutlined style={{ marginRight: 8 }} />
        Configuración de la Institución
      </Title>
      <Text type="secondary">
        Ajuste los parámetros de identidad de la institución.
      </Text>

      <Card style={{ marginTop: 24, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          <Title level={4}>Identidad de la Institución</Title>
          <Divider style={{ marginTop: 0 }} />

          <Form.Item
            label="Nombre de la Institución"
            name="institution_name"
          >
            <Input placeholder="Ej: Unidad Educativa Colegio Ejemplo" />
          </Form.Item>

          <Form.Item
            label="Logo de la Institución"
            tooltip="Este logo se usará posteriormente en reportes y encabezados"
          >
            <Form.Item name="institution_logo" noStyle>
              <Input type="hidden" />
            </Form.Item>
            <Upload.Dragger
              name="logo"
              listType="picture-card"
              className="avatar-uploader"
              showUploadList={false}
              beforeUpload={(file) => {
                // Validar que sea una imagen
                if (!file.type.startsWith('image/')) {
                  message.error('Solo se permiten archivos de imagen');
                  return Upload.LIST_IGNORE;
                }

                // Validar tamaño (máximo 5MB)
                if (file.size > 5 * 1024 * 1024) {
                  message.error('La imagen no debe superar los 5MB');
                  return Upload.LIST_IGNORE;
                }

                // Crear una vista previa
                const reader = new FileReader();
                reader.onload = () => {
                  setLogoPreview(reader.result as string);
                };
                reader.readAsDataURL(file);

                // Subir el archivo inmediatamente
                const formData = new FormData();
                formData.append('logo', file);

                api.post('/upload/logo', formData, {
                  headers: {
                    'Content-Type': 'multipart/form-data'
                  }
                })
                .then(response => {
                  message.success('Logo subido correctamente');
                  form.setFieldsValue({ institution_logo: response.data.filename });
                })
                .catch(error => {
                  console.error('Error al subir el logo:', error);
                  message.error('Error al subir el logo');
                  setLogoPreview('');
                });

                return false; // prevenir upload automático
              }}
              style={{
                width: '100%',
                maxWidth: '400px',
                height: '200px',
                border: '2px dashed #d9d9d9',
                borderRadius: '8px',
                backgroundColor: logoPreview ? '#f6ffed' : '#fafafa',
                cursor: 'pointer',
                transition: 'all 0.3s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}
            >
              {logoPreview ? (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}>
                  <img
                    src={logoPreview}
                    alt="Logo de la institución"
                    style={{
                      maxWidth: '80%',
                      maxHeight: '80%',
                      objectFit: 'contain',
                      borderRadius: '4px'
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0, 0, 0, 0.6)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    Haz clic para cambiar
                  </div>
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '20px'
                }}>
                  <UploadOutlined style={{
                    fontSize: '48px',
                    color: '#40a9ff',
                    marginBottom: '16px'
                  }} />
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#262626',
                    marginBottom: '8px'
                  }}>
                    Logo de la Institución
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#8c8c8c',
                    marginBottom: '8px'
                  }}>
                    Haz clic o arrastra una imagen aquí
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#bfbfbf'
                  }}>
                    JPG, PNG, GIF (máx. 5MB)
                  </div>
                </div>
              )}
            </Upload.Dragger>
          </Form.Item>

          <Divider />

          <Space size="middle">
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saving}
              size="large"
            >
              Guardar Cambios
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
};

export default SettingsManagement;
