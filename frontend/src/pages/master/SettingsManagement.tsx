import React, { useState, useEffect } from 'react';
import { Card, Form, InputNumber, Button, Typography, Space, message, Divider, Spin } from 'antd';
import { SettingOutlined, SaveOutlined } from '@ant-design/icons';
import api from '@/services/api';

const { Title, Text } = Typography;

const SettingsManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await api.get('/settings');
        // Pre-fill form with existing settings
        form.setFieldsValue({
          max_grade: res.data.max_grade ? Number(res.data.max_grade) : 20
        });
      } catch (error) {
        console.error('Error fetching settings', error);
        message.error('Error al cargar configuraciones');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [form]);

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      await api.post('/settings', { settings: values });
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
        Configuración del Sistema
      </Title>
      <Text type="secondary">
        Ajuste los parámetros globales que rigen el comportamiento de la institución.
      </Text>

      <Card style={{ marginTop: 24, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ max_grade: 20 }}
        >
          <Title level={4}>Académico</Title>
          <Divider style={{ marginTop: 0 }} />

          <Form.Item
            label="Nota Máxima de Calificación"
            name="max_grade"
            tooltip="Define la escala de evaluación del sistema (ej: 20 para escala venezolana, 100 para porcentaje)"
            rules={[{ required: true, message: 'Por favor ingrese la nota máxima' }]}
          >
            <InputNumber
              min={1}
              max={1000}
              style={{ width: '200px' }}
              size="large"
              placeholder="Ej: 20"
            />
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

      <Card style={{ marginTop: 24, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
        <Text strong>Próximamente:</Text>
        <ul style={{ marginTop: 8, color: '#555' }}>
          <li>Nombre de la Institución</li>
          <li>Logo y Membrete Oficial</li>
          <li>Firma del Director</li>
          <li>Bloqueo de Modificación de Notas tras Cierre de Lapso</li>
        </ul>
      </Card>
    </div>
  );
};

export default SettingsManagement;
