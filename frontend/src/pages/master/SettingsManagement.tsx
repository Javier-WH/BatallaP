/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, message, Spin, Upload, Segmented } from 'antd';
import { SettingOutlined, SaveOutlined, UploadOutlined, BankOutlined, BorderOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '@/services/api';
import { useSchool } from '@/context/SchoolContext';

const { Text } = Typography;

interface SettingsFormValues {
  institution_name?: string;
  institution_logo?: string;
  institution_logo_shape?: 'circle' | 'square';
}

const SettingsManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const { refreshSettings } = useSchool();

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await api.get('/settings');
        form.setFieldsValue({
          institution_name: res.data.institution_name || '',
          institution_logo: res.data.institution_logo || '',
          institution_logo_shape: res.data.institution_logo_shape || 'square',
        });

        try {
          const logoResponse = await api.get('/upload/logo', { responseType: 'blob' });
          const logoUrl = URL.createObjectURL(logoResponse.data);
          setLogoPreview(logoUrl);
        } catch {
          console.log('No logo found');
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
      await refreshSettings();
      message.success('Configuraciones guardadas correctamente');
    } catch (error) {
      console.error('Error saving settings', error);
      message.error('Error al guardar configuraciones');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-24 gap-4">
      <Spin size="large" />
      <Text className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Sincronizando Parámetros...</Text>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <BankOutlined className="text-brand-primary" /> Institución
        </h1>
        <p className="text-slate-500 font-medium">Define la identidad visual y el nombre oficial que aparecerá en todo el sistema y reportes.</p>
      </div>

      <Card className="glass-card overflow-hidden !p-0">
        <div className="bg-slate-900 px-8 py-6">
          <h2 className="text-white text-xl font-bold">Identidad Institucional</h2>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">Configuración del Perfil Maestro</p>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          className="p-8"
          requiredMark={false}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
              <Form.Item
                label={<span className="text-slate-700 font-bold">Nombre de la Institución</span>}
                name="institution_name"
                rules={[{ required: true, message: 'El nombre es obligatorio' }]}
              >
                <Input
                  placeholder="Ej: U.E. Colegio Batalla de la Victoria"
                  className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                />
              </Form.Item>

              <Form.Item
                label={<span className="text-slate-700 font-bold">Forma del Logo</span>}
                name="institution_logo_shape"
              >
                <Segmented
                  block
                  value={form.getFieldValue('institution_logo_shape')}
                  onChange={(val) => {
                    form.setFieldsValue({ institution_logo_shape: val });
                    const currentValues = form.getFieldsValue();
                    onFinish(currentValues);
                  }}
                  options={[
                    { label: 'Cuadrado', value: 'square', icon: <BorderOutlined /> },
                    { label: 'Redondo', value: 'circle', icon: <CheckCircleOutlined /> },
                  ]}
                  className="rounded-xl p-1 bg-slate-100"
                />
              </Form.Item>

              <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100/50">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <SettingOutlined />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-blue-900">Nota Importante</p>
                    <p className="text-xs text-blue-700/80 leading-relaxed">
                      El nombre y el logo se sincronizan automáticamente con el login y los encabezados de todos los módulos del sistema.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <span className="text-slate-700 font-bold block mb-2">Escudo / Logo Oficial</span>
              <Upload.Dragger
                name="logo"
                showUploadList={false}
                beforeUpload={(file) => {
                  if (!file.type.startsWith('image/')) {
                    message.error('Solo se permiten imágenes');
                    return Upload.LIST_IGNORE;
                  }
                  if (file.size > 5 * 1024 * 1024) {
                    message.error('Máximo 5MB');
                    return Upload.LIST_IGNORE;
                  }

                  const formData = new FormData();
                  formData.append('logo', file);

                  api.post('/upload/logo', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                  })
                    .then(async () => {
                      message.success('Logo actualizado');
                      await refreshSettings();
                      // Refetch local preview
                      const logoResponse = await api.get('/upload/logo', { responseType: 'blob' });
                      setLogoPreview(URL.createObjectURL(logoResponse.data));
                    })
                    .catch(() => message.error('Error al subir logo'));

                  return false;
                }}
                className="!rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-white hover:border-brand-primary transition-all overflow-hidden"
              >
                {logoPreview ? (
                  <div className="p-4 relative group h-48 flex flex-col items-center justify-center">
                    <img
                      src={logoPreview}
                      alt="Preview"
                      className={`max-h-full max-w-full object-contain drop-shadow-2xl translate-y-2 group-hover:scale-110 transition-transform duration-500 ${form.getFieldValue('institution_logo_shape') === 'circle' ? 'rounded-full' : 'rounded-xl'}`}
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                      <div className="bg-white px-4 py-2 rounded-xl text-slate-900 font-black text-[10px] uppercase tracking-widest shadow-xl">Cambiar Logo</div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 space-y-4">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm mx-auto flex items-center justify-center">
                      <UploadOutlined className="text-3xl text-brand-primary" />
                    </div>
                    <div>
                      <p className="text-slate-900 font-bold">Haz clic o arrastra el logo</p>
                      <p className="text-slate-500 text-xs font-medium">PNG, JPG (Máx. 5MB)</p>
                    </div>
                  </div>
                )}
              </Upload.Dragger>
            </div>
          </div>

          <div className="mt-12 flex justify-end">
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saving}
              className="h-14 px-12 bg-slate-900 border-none text-white font-black rounded-2xl shadow-2xl shadow-indigo-500/20 hover:scale-105 transition-all text-sm uppercase tracking-widest"
            >
              Guardar Identidad
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default SettingsManagement;
