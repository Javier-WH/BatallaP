import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, message, Spin, Segmented, DatePicker } from 'antd';
import { UserSwitchOutlined, SaveOutlined } from '@ant-design/icons';
import api from '@/services/api';
import { useSchool } from '@/context/SchoolContext';

const { Text } = Typography;

interface EncargadoFormValues {
  encargado_name?: string;
  encargado_first_names?: string;
  encargado_last_names?: string;
  encargado_document?: string;
  encargado_gender?: 'M' | 'F';
  encargado_reason?: string;
  encargado_start_date?: any;
  encargado_end_date?: any;
}

const DirectorEncargado: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [encargadoName, setEncargadoName] = useState('');
  const [encargadoFirstNames, setEncargadoFirstNames] = useState('');
  const [encargadoLastNames, setEncargadoLastNames] = useState('');
  const [encargadoDocument, setEncargadoDocument] = useState('');
  const [encargadoGender, setEncargadoGender] = useState<'M' | 'F'>('M');
  const [encargadoReason, setEncargadoReason] = useState('');
  const { refreshSettings } = useSchool();

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await api.get('/settings');
        setEncargadoName(res.data.encargado_name || '');
        setEncargadoFirstNames(res.data.encargado_first_names || '');
        setEncargadoLastNames(res.data.encargado_last_names || '');
        setEncargadoDocument(res.data.encargado_document || '');
        setEncargadoGender(res.data.encargado_gender === 'F' ? 'F' : 'M');
        setEncargadoReason(res.data.encargado_reason || '');

        form.setFieldsValue({
          encargado_name: res.data.encargado_name || '',
          encargado_first_names: res.data.encargado_first_names || '',
          encargado_last_names: res.data.encargado_last_names || '',
          encargado_document: res.data.encargado_document || '',
          encargado_gender: res.data.encargado_gender === 'F' ? 'F' : 'M',
          encargado_reason: res.data.encargado_reason || '',
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

  const onFinish = async () => {
    setSaving(true);
    try {
      const finalPayload = {
        encargado_name: encargadoName,
        encargado_first_names: encargadoFirstNames,
        encargado_last_names: encargadoLastNames,
        encargado_document: encargadoDocument,
        encargado_gender: encargadoGender,
        encargado_reason: encargadoReason,
      };

      await api.post('/settings', { settings: finalPayload });
      await refreshSettings();
      message.success('Datos del Director Encargado guardados correctamente');
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
      <Text className="text-[var(--color-text-muted)] font-bold uppercase tracking-widest text-[10px]">Cargando...</Text>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto pr-4">
      <div className="max-w-4xl mx-auto space-y-8 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-[var(--color-text-main)] tracking-tight flex items-center gap-3">
            <UserSwitchOutlined className="text-brand-primary" /> Director Encargado
          </h1>
          <p className="text-[var(--color-text-muted)] font-medium">Designe al Director Encargado que aparecerá en los documentos oficiales cuando el Director titular no esté disponible.</p>
        </div>

        <Card className="glass-card overflow-hidden" styles={{ body: { padding: 0 } }}>
          <div style={{ padding: '48px' }}>
            <div className="theme-panel-header px-12 py-8 mx-[-48px] mt-[-48px] mb-12 block">
              <h2 className="text-[var(--color-header-text)] text-xl font-bold">Datos del Director Encargado</h2>
              <p className="text-[var(--color-header-text)]/60 text-xs font-medium uppercase tracking-widest mt-1">Designación temporal del Director suplente</p>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              requiredMark={false}
            >
              <div className="space-y-6">
                <Form.Item
                  label={<span className="text-[var(--color-text-main)] font-bold">Nombre del Director Encargado</span>}
                  name="encargado_name"
                  tooltip="Nombre corto del Director Encargado (se usa en documentos oficiales)"
                >
                  <Input
                    placeholder="Nombre completo del Director Encargado"
                    className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                    onChange={(e) => setEncargadoName(e.target.value)}
                  />
                </Form.Item>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Form.Item
                    label={<span className="text-[var(--color-text-main)] font-bold">Nombres (formato largo)</span>}
                    name="encargado_first_names"
                    tooltip="Nombres del Director Encargado para documentos oficiales"
                  >
                    <Input
                      placeholder="Ej: Juan Carlos"
                      className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                      onChange={(e) => setEncargadoFirstNames(e.target.value)}
                    />
                  </Form.Item>

                  <Form.Item
                    label={<span className="text-[var(--color-text-main)] font-bold">Apellidos (formato largo)</span>}
                    name="encargado_last_names"
                    tooltip="Apellidos del Director Encargado para documentos oficiales"
                  >
                    <Input
                      placeholder="Ej: Pérez Gómez"
                      className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                      onChange={(e) => setEncargadoLastNames(e.target.value)}
                    />
                  </Form.Item>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Form.Item
                    label={<span className="text-[var(--color-text-main)] font-bold">Cédula del Director Encargado</span>}
                    name="encargado_document"
                  >
                    <Input
                      placeholder="V-12345678"
                      className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                      onChange={(e) => setEncargadoDocument(e.target.value)}
                    />
                  </Form.Item>

                  <Form.Item
                    label={<span className="text-[var(--color-text-main)] font-bold">Género del Director Encargado</span>}
                    name="encargado_gender"
                    tooltip="Determina si en los documentos se muestra 'El Director Encargado' o 'La Directora Encargada'"
                  >
                    <Segmented
                      block
                      value={encargadoGender}
                      onChange={(val: 'M' | 'F') => {
                        setEncargadoGender(val);
                        form.setFieldsValue({ encargado_gender: val });
                      }}
                      options={[
                        { label: 'Masculino (El Director Encargado)', value: 'M' },
                        { label: 'Femenino (La Directora Encargada)', value: 'F' },
                      ]}
                      className="rounded-xl p-1"
                    />
                  </Form.Item>
                </div>

                <Form.Item
                  label={<span className="text-[var(--color-text-main)] font-bold">Motivo de la designación</span>}
                  name="encargado_reason"
                  tooltip="Razón por la cual se designa un Director Encargado (ej: vacaciones, licencia médica, permiso, etc.)"
                >
                  <Input.TextArea
                    placeholder="Ej: Licencia médica del Director titular del 01/03/2026 al 15/03/2026"
                    rows={3}
                    className="border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                    onChange={(e) => setEncargadoReason(e.target.value)}
                  />
                </Form.Item>

                <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-100/50">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                      <UserSwitchOutlined />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-amber-900">Información</p>
                      <p className="text-xs text-amber-700/80 leading-relaxed">
                        Cuando estos datos estén configurados, los documentos oficiales podrán mostrar al Director Encargado en lugar del Director titular. Deje los campos vacíos si no hay Director Encargado designado actualmente.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={saving}
                  className="h-14 px-12 theme-panel-header border-none text-[var(--color-header-text)] font-black rounded-2xl shadow-2xl hover:scale-105 transition-all text-sm uppercase tracking-widest"
                >
                  Guardar Datos
                </Button>
              </div>
            </Form>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DirectorEncargado;
