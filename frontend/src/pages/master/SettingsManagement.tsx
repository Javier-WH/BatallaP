import React, { useState, useEffect } from 'react';
import { Card, Form, Input, InputNumber, Button, Typography, Space, message, Divider, Spin, Radio, Switch, DatePicker, Upload } from 'antd';
import { SettingOutlined, SaveOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
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
          max_grade: res.data.max_grade ? Number(res.data.max_grade) : 20,
          passing_grade: res.data.passing_grade ? Number(res.data.passing_grade) : undefined,
          grade_lock_mode: res.data.grade_lock_mode || 'never',
          // Term locks (booleans stored as strings)
          term1_locked: res.data.term1_locked === 'true',
          term2_locked: res.data.term2_locked === 'true',
          term3_locked: res.data.term3_locked === 'true',
          term1_open_at: res.data.term1_open_at ? dayjs(res.data.term1_open_at) : null,
          term1_close_at: res.data.term1_close_at ? dayjs(res.data.term1_close_at) : null,
          term2_open_at: res.data.term2_open_at ? dayjs(res.data.term2_open_at) : null,
          term2_close_at: res.data.term2_close_at ? dayjs(res.data.term2_close_at) : null,
          term3_open_at: res.data.term3_open_at ? dayjs(res.data.term3_open_at) : null,
          term3_close_at: res.data.term3_close_at ? dayjs(res.data.term3_close_at) : null,
          institution_name: res.data.institution_name || '',
          institution_logo_data: res.data.institution_logo_data || undefined,
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
      const payload = { ...values };

      // Normalizar fechas a ISO
      const dateKeys = [
        'term1_open_at', 'term1_close_at',
        'term2_open_at', 'term2_close_at',
        'term3_open_at', 'term3_close_at',
      ];
      dateKeys.forEach((key) => {
        const v = (payload as any)[key];
        if (v && v.toISOString) {
          (payload as any)[key] = v.toISOString();
        }
      });

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
          initialValues={{
            max_grade: 20,
            grade_lock_mode: 'never',
          }}
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

          <Form.Item
            label="Nota Mínima Aprobatoria"
            name="passing_grade"
            tooltip="Nota mínima necesaria para aprobar una materia"
            rules={[
              { required: true, message: 'Por favor ingrese la nota mínima aprobatoria' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const max = getFieldValue('max_grade');
                  if (value == null) return Promise.resolve();
                  if (max != null && value > max) {
                    return Promise.reject(new Error('La nota mínima no puede ser mayor que la nota máxima'));
                  }
                  if (value <= 0) {
                    return Promise.reject(new Error('La nota mínima debe ser mayor que 0'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <InputNumber
              min={1}
              max={1000}
              style={{ width: '200px' }}
              size="large"
              placeholder="Ej: 10"
            />
          </Form.Item>

          <Form.Item
            label="Bloqueo de modificación de calificaciones"
            name="grade_lock_mode"
            tooltip="Define cuánto tiempo después de registrar una nota el profesor podrá seguir modificándola"
          >
            <Radio.Group>
              <Space direction="vertical">
                <Radio value="never">No bloquear nunca</Radio>
                <Radio value="1h">Bloquear luego de 1 hora</Radio>
                <Radio value="3h">Bloquear luego de 3 horas</Radio>
                <Radio value="8h">Bloquear luego de 8 horas</Radio>
                <Radio value="24h">Bloquear luego de 24 horas</Radio>
                <Radio value="36h">Bloquear luego de 36 horas</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          <Divider />

          <Title level={4}>Lapsos</Title>
          <Divider style={{ marginTop: 0 }} />

          {[1, 2, 3].map((lapso) => (
            <Card key={lapso} size="small" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Text strong>Lapso {lapso}</Text>
                  <Form.Item
                    name={`term${lapso}_locked`}
                    valuePropName="checked"
                    style={{ marginBottom: 0 }}
                  >
                    <Switch checkedChildren="Bloqueado" unCheckedChildren="Desbloqueado" />
                  </Form.Item>
                </Space>

                <Space size="large" wrap>
                  <Form.Item
                    label="Apertura automática"
                    name={`term${lapso}_open_at`}
                  >
                    <DatePicker showTime format="YYYY-MM-DD HH:mm" />
                  </Form.Item>
                  <Form.Item
                    label="Cierre automático"
                    name={`term${lapso}_close_at`}
                  >
                    <DatePicker showTime format="YYYY-MM-DD HH:mm" />
                  </Form.Item>
                </Space>
              </Space>
            </Card>
          ))}

          <Divider />

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
            <Form.Item name="institution_logo_data" noStyle>
              <Input type="hidden" />
            </Form.Item>
            <Upload
              beforeUpload={(file) => {
                const reader = new FileReader();
                reader.onload = () => {
                  form.setFieldsValue({ institution_logo_data: reader.result });
                };
                reader.readAsDataURL(file);
                return false; // prevenir upload real
              }}
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />}>Seleccionar Logo</Button>
            </Upload>

            {form.getFieldValue('institution_logo_data') && (
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">Vista previa:</Text>
                <div style={{ marginTop: 8 }}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <img
                    src={form.getFieldValue('institution_logo_data')}
                    style={{ maxHeight: 80, maxWidth: 240, border: '1px solid #eee', padding: 4, background: '#fff' }}
                  />
                </div>
              </div>
            )}
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
