/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, message, Spin, Upload, Segmented, AutoComplete } from 'antd';
import { SettingOutlined, SaveOutlined, UploadOutlined, BankOutlined, BorderOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '@/services/api';
import { useSchool } from '@/context/SchoolContext';

const { Text } = Typography;

interface PlantelOption {
  code: string;
  name: string;
  state: string;
}

interface SettingsFormValues {
  institution_name?: string;
  institution_dea_code?: string;
  institution_logo?: string;
  institution_logo_shape?: 'circle' | 'square';
  theme_primary_color?: string;
  theme_secondary_color?: string;
  theme_text_color?: string;
}

const SettingsManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [plantelOptions, setPlantelOptions] = useState<{ value: string; label: string }[]>([]);
  const [primaryColor, setPrimaryColor] = useState('#1e40af');
  const [secondaryColor, setSecondaryColor] = useState('#0ea5e9');
  const [textColor, setTextColor] = useState('#0f172a');
  const [sidebarColor, setSidebarColor] = useState('#0f172a');
  const [pageBgColor, setPageBgColor] = useState('#f8fafc');
  const [panelHeaderColor, setPanelHeaderColor] = useState('#0f172a');
  const [contentBgColor, setContentBgColor] = useState('#ffffff');
  const [accentColor, setAccentColor] = useState('#1e40af');
  const { refreshSettings } = useSchool();

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await api.get('/settings');
        const pc = res.data.theme_primary_color || '#1e40af';
        const sc = res.data.theme_secondary_color || '#0ea5e9';
        const tc = res.data.theme_text_color || '#0f172a';
        const sbc = res.data.theme_sidebar_color || '#0f172a';
        const pbg = res.data.theme_page_bg || '#f8fafc';
        const phc = res.data.theme_panel_header || '#0f172a';
        const cbc = res.data.theme_content_bg || '#ffffff';
        const ac = res.data.theme_accent_color || '#1e40af';

        setPrimaryColor(pc);
        setSecondaryColor(sc);
        setTextColor(tc);
        setSidebarColor(sbc);
        setPageBgColor(pbg);
        setPanelHeaderColor(phc);
        setContentBgColor(cbc);
        setAccentColor(ac);

        form.setFieldsValue({
          institution_name: res.data.institution_name || '',
          institution_dea_code: res.data.institution_dea_code || '',
          institution_logo: res.data.institution_logo || '',
          institution_logo_shape: res.data.institution_logo_shape || 'square',
          theme_primary_color: pc,
          theme_secondary_color: sc,
          theme_text_color: tc,
          theme_sidebar_color: sbc,
          theme_page_bg: pbg,
          theme_panel_header: phc,
          theme_content_bg: cbc,
          theme_accent_color: ac,
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

  const handlePlantelSearch = async (searchText: string) => {
    if (!searchText || searchText.length < 2) {
      setPlantelOptions([]);
      return;
    }
    try {
      const response = await api.get('/planteles/search', { params: { q: searchText, limit: 10 } });
      const options = response.data.map((p: PlantelOption) => ({
        value: p.code,
        label: `[${p.code}] — ${p.name} (${p.state})`
      }));
      setPlantelOptions(options);
    } catch (error) {
      console.error('Error searching planteles:', error);
    }
  };

  const onFinish = async (values: SettingsFormValues) => {
    setSaving(true);
    try {
      const { institution_logo, ...payload } = values;
      
      // Manually include the color states because they are native inputs without Form.Item
      const finalPayload = {
        ...payload,
        theme_primary_color: primaryColor,
        theme_secondary_color: secondaryColor,
        theme_text_color: textColor,
        theme_sidebar_color: sidebarColor,
        theme_page_bg: pageBgColor,
        theme_panel_header: panelHeaderColor,
        theme_content_bg: contentBgColor,
        theme_accent_color: accentColor,
      };

      await api.post('/settings', { settings: finalPayload });
      await refreshSettings();
      message.success('Configuraciones guardadas y aplicadas a toda la plataforma');
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
    <div className="h-full overflow-y-auto pr-4">
      <div className="max-w-4xl mx-auto space-y-8 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
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
                label={<span className="text-slate-700 font-bold">Código DEA de la Institución</span>}
                name="institution_dea_code"
                tooltip="Código DEA oficial del plantel educativo (se asociará a las notas finales)"
              >
                <AutoComplete
                  options={plantelOptions}
                  onSearch={handlePlantelSearch}
                  placeholder="Buscar por código o nombre del plantel..."
                  className="h-12"
                  filterOption={false}
                  allowClear
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

          <div className="mt-12">
            <div className="bg-slate-900 px-8 py-6 rounded-t-2xl mx-[-2rem]">
              <h2 className="text-white text-xl font-bold">Apariencia y Colores</h2>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">Configuración del Tema Global</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 py-8">
              {/* Primary Color */}
              <div>
                <label className="text-slate-700 font-bold block mb-2">Color Primario</label>
                <p className="text-xs text-slate-400 mb-3">Botones, menús y acentos visuales.</p>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => {
                      setPrimaryColor(e.target.value);
                      form.setFieldsValue({ theme_primary_color: e.target.value });
                    }}
                    className="h-12 w-16 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5 bg-white"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">{primaryColor}</span>
                    <div className="h-2 w-24 rounded-full" style={{ backgroundColor: primaryColor }} />
                  </div>
                </div>
              </div>

              {/* Secondary Color */}
              <div>
                <label className="text-slate-700 font-bold block mb-2">Color Secundario</label>
                <p className="text-xs text-slate-400 mb-3">Badges, enlaces y estados info.</p>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => {
                      setSecondaryColor(e.target.value);
                      form.setFieldsValue({ theme_secondary_color: e.target.value });
                    }}
                    className="h-12 w-16 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5 bg-white"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">{secondaryColor}</span>
                    <div className="h-2 w-24 rounded-full" style={{ backgroundColor: secondaryColor }} />
                  </div>
                </div>
              </div>

              {/* Text Color */}
              <div>
                <label className="text-slate-700 font-bold block mb-2">Color de Texto Base</label>
                <p className="text-xs text-slate-400 mb-3">Color base del texto de la app.</p>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => {
                      setTextColor(e.target.value);
                      form.setFieldsValue({ theme_text_color: e.target.value });
                    }}
                    className="h-12 w-16 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5 bg-white"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">{textColor}</span>
                    <div className="h-2 w-24 rounded-full" style={{ backgroundColor: textColor }} />
                  </div>
                </div>
              </div>

              {/* Sidebar Color */}
              <div>
                <label className="text-slate-700 font-bold block mb-2">Color de Barra Lateral</label>
                <p className="text-xs text-slate-400 mb-3">Color de fondo para el menú principal lateral.</p>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={sidebarColor}
                    onChange={(e) => {
                      setSidebarColor(e.target.value);
                      form.setFieldsValue({ theme_sidebar_color: e.target.value });
                    }}
                    className="h-12 w-16 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5 bg-white"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">{sidebarColor}</span>
                    <div className="h-2 w-24 rounded-full" style={{ backgroundColor: sidebarColor }} />
                  </div>
                </div>
              </div>

              {/* Page Background */}
              <div>
                <label className="text-slate-700 font-bold block mb-2">Fondo de Página</label>
                <p className="text-xs text-slate-400 mb-3">Color de fondo global del layout.</p>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={pageBgColor}
                    onChange={(e) => {
                      setPageBgColor(e.target.value);
                      form.setFieldsValue({ theme_page_bg: e.target.value });
                    }}
                    className="h-12 w-16 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5 bg-white"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">{pageBgColor}</span>
                    <div className="h-2 w-24 rounded-full" style={{ backgroundColor: pageBgColor }} />
                  </div>
                </div>
              </div>

              {/* Panel Header */}
              <div>
                <label className="text-slate-700 font-bold block mb-2">Encabezado de Panel</label>
                <p className="text-xs text-slate-400 mb-3">Fondo para los títulos superiores en cada vista.</p>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={panelHeaderColor}
                    onChange={(e) => {
                      setPanelHeaderColor(e.target.value);
                      form.setFieldsValue({ theme_panel_header: e.target.value });
                    }}
                    className="h-12 w-16 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5 bg-white"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">{panelHeaderColor}</span>
                    <div className="h-2 w-24 rounded-full" style={{ backgroundColor: panelHeaderColor }} />
                  </div>
                </div>
              </div>

              {/* Content Background */}
              <div>
                <label className="text-slate-700 font-bold block mb-2">Fondo de Contenido</label>
                <p className="text-xs text-slate-400 mb-3">Fondo de las tarjetas blancas (tablas, formularios).</p>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={contentBgColor}
                    onChange={(e) => {
                      setContentBgColor(e.target.value);
                      form.setFieldsValue({ theme_content_bg: e.target.value });
                    }}
                    className="h-12 w-16 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5 bg-white"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">{contentBgColor}</span>
                    <div className="h-2 w-24 rounded-full" style={{ border: '1px solid #ccc', backgroundColor: contentBgColor }} />
                  </div>
                </div>
              </div>

              {/* Accent Color */}
              <div>
                <label className="text-slate-700 font-bold block mb-2">Color de Acento</label>
                <p className="text-xs text-slate-400 mb-3">Detalles sutiles e iconos decorativos.</p>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => {
                      setAccentColor(e.target.value);
                      form.setFieldsValue({ theme_accent_color: e.target.value });
                    }}
                    className="h-12 w-16 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5 bg-white"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">{accentColor}</span>
                    <div className="h-2 w-24 rounded-full" style={{ backgroundColor: accentColor }} />
                  </div>
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
              className="h-14 px-12 bg-slate-900 border-none text-white font-black rounded-2xl shadow-2xl shadow-indigo-500/20 hover:scale-105 transition-all text-sm uppercase tracking-widest"
            >
              Guardar Identidad
            </Button>
          </div>
        </Form>
        </Card>
      </div>
    </div>
  );
};

export default SettingsManagement;
