import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, message, Spin, Segmented } from 'antd';
import { IdcardOutlined, SaveOutlined } from '@ant-design/icons';
import api from '@/services/api';
import { useSchool } from '@/context/SchoolContext';

const { Text } = Typography;

interface CoordinatorFormValues {
  control_estudios_name?: string;
  control_estudios_first_names?: string;
  control_estudios_last_names?: string;
  control_estudios_document?: string;
  control_estudios_gender?: 'M' | 'F';
}

const DirectorSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [coordinatorName, setCoordinatorName] = useState('');
  const [coordinatorFirstNames, setCoordinatorFirstNames] = useState('');
  const [coordinatorLastNames, setCoordinatorLastNames] = useState('');
  const [coordinatorDocument, setCoordinatorDocument] = useState('');
  const [coordinatorGender, setCoordinatorGender] = useState<'M' | 'F'>('M');
  const { refreshSettings } = useSchool();

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await api.get('/settings');
        setCoordinatorName(res.data.control_estudios_name || '');
        setCoordinatorFirstNames(res.data.control_estudios_first_names || '');
        setCoordinatorLastNames(res.data.control_estudios_last_names || '');
        setCoordinatorDocument(res.data.control_estudios_document || '');
        setCoordinatorGender(res.data.control_estudios_gender === 'F' ? 'F' : 'M');

        form.setFieldsValue({
          control_estudios_name: res.data.control_estudios_name || '',
          control_estudios_first_names: res.data.control_estudios_first_names || '',
          control_estudios_last_names: res.data.control_estudios_last_names || '',
          control_estudios_document: res.data.control_estudios_document || '',
          control_estudios_gender: res.data.control_estudios_gender === 'F' ? 'F' : 'M',
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
        control_estudios_name: coordinatorName,
        control_estudios_first_names: coordinatorFirstNames,
        control_estudios_last_names: coordinatorLastNames,
        control_estudios_document: coordinatorDocument,
        control_estudios_gender: coordinatorGender,
      };

      await api.post('/settings', { settings: finalPayload });
      await refreshSettings();
      message.success('Datos del Coordinador guardados correctamente');
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
            <IdcardOutlined className="text-brand-primary" /> Coordinador de Control de Estudios
          </h1>
          <p className="text-[var(--color-text-muted)] font-medium">Define los datos del Coordinador de Control de Estudios que aparecerán en los documentos oficiales del plantel.</p>
        </div>

        <Card className="glass-card overflow-hidden" styles={{ body: { padding: 0 } }}>
          <div style={{ padding: '48px' }}>
            <div className="theme-panel-header px-12 py-8 mx-[-48px] mt-[-48px] mb-12 block">
              <h2 className="text-[var(--color-header-text)] text-xl font-bold">Datos del Coordinador</h2>
              <p className="text-[var(--color-header-text)]/60 text-xs font-medium uppercase tracking-widest mt-1">Responsable del Departamento de Control de Estudios</p>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              requiredMark={false}
            >
              <div className="space-y-6">
                <Form.Item
                  label={<span className="text-[var(--color-text-main)] font-bold">Nombre del Coordinador</span>}
                  name="control_estudios_name"
                  tooltip="Nombre corto del Coordinador de Control de Estudios (se usa en reportes y constancias)"
                >
                  <Input
                    placeholder="Nombre completo del Coordinador de Control de Estudios"
                    className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                    onChange={(e) => setCoordinatorName(e.target.value)}
                  />
                </Form.Item>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Form.Item
                    label={<span className="text-[var(--color-text-main)] font-bold">Nombres (formato largo)</span>}
                    name="control_estudios_first_names"
                    tooltip="Nombres del Coordinador para documentos oficiales (formato: Apellidos, Nombres)"
                  >
                    <Input
                      placeholder="Ej: María José"
                      className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                      onChange={(e) => setCoordinatorFirstNames(e.target.value)}
                    />
                  </Form.Item>

                  <Form.Item
                    label={<span className="text-[var(--color-text-main)] font-bold">Apellidos (formato largo)</span>}
                    name="control_estudios_last_names"
                    tooltip="Apellidos del Coordinador para documentos oficiales (formato: Apellidos, Nombres)"
                  >
                    <Input
                      placeholder="Ej: Pérez de Gómez"
                      className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                      onChange={(e) => setCoordinatorLastNames(e.target.value)}
                    />
                  </Form.Item>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Form.Item
                    label={<span className="text-[var(--color-text-main)] font-bold">Cédula del Coordinador</span>}
                    name="control_estudios_document"
                  >
                    <Input
                      placeholder="V-12345678"
                      className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                      onChange={(e) => setCoordinatorDocument(e.target.value)}
                    />
                  </Form.Item>

                  <Form.Item
                    label={<span className="text-[var(--color-text-main)] font-bold">Género del Coordinador</span>}
                    name="control_estudios_gender"
                    tooltip="Determina si en los documentos se muestra 'El Coordinador' o 'La Coordinadora'"
                  >
                    <Segmented
                      block
                      value={coordinatorGender}
                      onChange={(val: 'M' | 'F') => {
                        setCoordinatorGender(val);
                        form.setFieldsValue({ control_estudios_gender: val });
                      }}
                      options={[
                        { label: 'Masculino (El Coordinador)', value: 'M' },
                        { label: 'Femenino (La Coordinadora)', value: 'F' },
                      ]}
                      className="rounded-xl p-1"
                    />
                  </Form.Item>
                </div>

                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100/50">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                      <IdcardOutlined />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-blue-900">Información</p>
                      <p className="text-xs text-blue-700/80 leading-relaxed">
                        Estos datos se usarán en los documentos oficiales del plantel (constancias, resumen de rendimiento, notas certificadas, diarios de clase, etc.) para identificar al Coordinador de Control de Estudios.
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

export default DirectorSettings;
