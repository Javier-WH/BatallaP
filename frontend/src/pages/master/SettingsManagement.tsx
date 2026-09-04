/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, message, Spin, Upload, Segmented, AutoComplete } from 'antd';
import { SettingOutlined, SaveOutlined, UploadOutlined, BankOutlined, BorderOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
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
  institution_short_name?: string;
  institution_dea_code?: string;
  institution_code?: string;
  institution_level?: string;
  institution_logo?: string;
  institution_logo_shape?: 'circle' | 'square';
  time_format?: '12' | '24';
  director_name?: string;
  director_first_names?: string;
  director_last_names?: string;
  director_document?: string;
  director_gender?: 'M' | 'F';
  institution_address?: string;
  institution_state?: string;
  institution_municipality?: string;
  institution_parish?: string;
  institution_phone?: string;
  institution_cdcee?: string;
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
  const [secondaryColor, setSecondaryColor] = useState('#e2e8f0'); // Color Inactivo
  const [brandSecondaryColor, setBrandSecondaryColor] = useState('#0ea5e9'); // Nuevo Color Secundario
  const [textColor, setTextColor] = useState('#0f172a');
  const [sidebarColor, setSidebarColor] = useState('#0f172a');
  const [pageBgColor, setPageBgColor] = useState('#f8fafc');
  const [panelHeaderColor, setPanelHeaderColor] = useState('#0f172a');
  const [contentBgColor, setContentBgColor] = useState('#ffffff');
  const [accentColor, setAccentColor] = useState('#1e40af');
  const [headerTextColor, setHeaderTextColor] = useState('#ffffff');
  const [inputBgColor, setInputBgColor] = useState('#ffffff');
  const [mutedTextColor, setMutedTextColor] = useState('#94a3b8');
  const [directorName, setDirectorName] = useState('');
  const [directorFirstNames, setDirectorFirstNames] = useState('');
  const [directorLastNames, setDirectorLastNames] = useState('');
  const [directorDocument, setDirectorDocument] = useState('');
  const [directorGender, setDirectorGender] = useState<'M' | 'F'>('M');
  const [venezuelaData, setVenezuelaData] = useState<any[]>([]);
  const [stateOptions, setStateOptions] = useState<{ value: string; label: string }[]>([]);
  const [municipalityOptions, setMunicipalityOptions] = useState<{ value: string; label: string }[]>([]);
  const [parishOptions, setParishOptions] = useState<{ value: string; label: string }[]>([]);
  const { refreshSettings } = useSchool();

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await api.get('/settings');
        const pc = res.data.theme_primary_color || '#1e40af';
        const sc = res.data.theme_secondary_color || '#e2e8f0';
        const bsc = res.data.theme_brand_secondary || '#0ea5e9';
        const tc = res.data.theme_text_color || '#0f172a';
        const sbc = res.data.theme_sidebar_color || '#0f172a';
        const pbg = res.data.theme_page_bg || '#f8fafc';
        const phc = res.data.theme_panel_header || '#0f172a';
        const cbc = res.data.theme_content_bg || '#ffffff';
        const ac = res.data.theme_accent_color || '#1e40af';
        const htc = res.data.theme_header_text_color || '#ffffff';
        const ibc = res.data.theme_input_bg || '#ffffff';
        const mtc = res.data.theme_muted_text_color || '#94a3b8';

        setPrimaryColor(pc);
        setSecondaryColor(sc);
        setBrandSecondaryColor(bsc);
        setTextColor(tc);
        setSidebarColor(sbc);
        setPageBgColor(pbg);
        setPanelHeaderColor(phc);
        setContentBgColor(cbc);
        setAccentColor(ac);
        setHeaderTextColor(htc);
        setInputBgColor(ibc);
        setMutedTextColor(mtc);
        setDirectorName(res.data.director_name || '');
        setDirectorFirstNames(res.data.director_first_names || '');
        setDirectorLastNames(res.data.director_last_names || '');
        setDirectorDocument(res.data.director_document || '');
        setDirectorGender(res.data.director_gender === 'F' ? 'F' : 'M');

        form.setFieldsValue({
          institution_name: res.data.institution_name || '',
          institution_short_name: res.data.institution_short_name || '',
          institution_dea_code: res.data.institution_dea_code || '',
          institution_logo: res.data.institution_logo || '',
          institution_logo_shape: res.data.institution_logo_shape || 'square',
          time_format: res.data.time_format || '24',
          director_name: res.data.director_name || '',
          director_first_names: res.data.director_first_names || '',
          director_last_names: res.data.director_last_names || '',
          director_document: res.data.director_document || '',
          director_gender: res.data.director_gender === 'F' ? 'F' : 'M',
          institution_address: res.data.institution_address || '',
          institution_state: res.data.institution_state || '',
          institution_municipality: res.data.institution_municipality || '',
          institution_parish: res.data.institution_parish || '',
          institution_phone: res.data.institution_phone || '',
          institution_cdcee: res.data.institution_cdcee || '',
          institution_code: res.data.institution_code || '',
          institution_level: res.data.institution_level || '',
          theme_primary_color: pc,
          theme_secondary_color: sc,
          theme_brand_secondary: bsc,
          theme_text_color: tc,
          theme_sidebar_color: sbc,
          theme_page_bg: pbg,
          theme_panel_header: phc,
          theme_content_bg: cbc,
          theme_accent_color: ac,
          theme_header_text_color: htc,
          theme_input_bg: ibc,
          theme_muted_text_color: mtc,
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

  // Load Venezuela locations catalog
  useEffect(() => {
    api.get('/locations/venezuela')
      .then(res => {
        const data = res.data || [];
        setVenezuelaData(data);
        // Build state options
        const states = data.map((s: any) => ({ value: s.estado, label: s.estado }));
        states.sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label));
        setStateOptions(states);
        // Load municipalities for the currently selected state
        const currentState = form.getFieldValue('institution_state');
        if (currentState) {
          updateMunicipalityOptions(currentState);
        }
      })
      .catch(() => {});
  }, [form]);

  // Update municipality options when state changes
  const updateMunicipalityOptions = (stateName: string) => {
    if (!stateName) {
      setMunicipalityOptions([]);
      setParishOptions([]);
      return;
    }
    const state = venezuelaData.find((s: any) => s.estado === stateName);
    const munis = (state?.municipios || []).map((m: any) => ({ value: m.municipio, label: m.municipio }));
    munis.sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label));
    setMunicipalityOptions(munis);
  };

  // Update parish options when municipality changes
  const updateParishOptions = (municipalityName: string) => {
    if (!municipalityName) {
      setParishOptions([]);
      return;
    }
    const currentState = form.getFieldValue('institution_state');
    const state = venezuelaData.find((s: any) => s.estado === currentState);
    const m = (state?.municipios || []).find((mm: any) => mm.municipio === municipalityName);
    const parishes = (m?.parroquias || []).map((p: string) => ({ value: p, label: p }));
    setParishOptions(parishes);
  };

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
        director_name: directorName,
        director_first_names: directorFirstNames,
        director_last_names: directorLastNames,
        director_document: directorDocument,
        director_gender: directorGender,
        theme_primary_color: primaryColor,
        theme_secondary_color: secondaryColor,
        theme_brand_secondary: brandSecondaryColor,
        theme_text_color: textColor,
        theme_sidebar_color: sidebarColor,
        theme_page_bg: pageBgColor,
        theme_panel_header: panelHeaderColor,
        theme_content_bg: contentBgColor,
        theme_accent_color: accentColor,
        theme_header_text_color: headerTextColor,
        theme_input_bg: inputBgColor,
        theme_muted_text_color: mutedTextColor,
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
      <Text className="text-[var(--color-text-muted)] font-bold uppercase tracking-widest text-[10px]">Sincronizando Parámetros...</Text>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto pr-4">
      <div className="max-w-4xl mx-auto space-y-8 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Page Header */}
        <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black text-[var(--color-text-main)] tracking-tight flex items-center gap-3">
          <BankOutlined className="text-brand-primary" /> Institución
        </h1>
        <p className="text-[var(--color-text-muted)] font-medium">Define la identidad visual y el nombre oficial que aparecerá en todo el sistema y reportes.</p>
      </div>

        <Card className="glass-card overflow-hidden" styles={{ body: { padding: 0 } }}>
          <div style={{ padding: '48px' }}>
            <div className="theme-panel-header px-12 py-8 mx-[-48px] mt-[-48px] mb-12 block">
              <h2 className="text-[var(--color-header-text)] text-xl font-bold">Identidad Institucional</h2>
              <p className="text-[var(--color-header-text)]/60 text-xs font-medium uppercase tracking-widest mt-1">Configuración del Perfil Maestro</p>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              requiredMark={false}
            >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
              <Form.Item
                label={<span className="text-[var(--color-text-main)] font-bold">Nombre de la Institución</span>}
                name="institution_name"
                rules={[{ required: true, message: 'El nombre es obligatorio' }]}
              >
                <Input
                  placeholder="Ej: U.E. Colegio Batalla de la Victoria"
                  className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                />
              </Form.Item>

              <Form.Item
                label={<span className="text-[var(--color-text-main)] font-bold">Nombre Abreviado de la Institución</span>}
                name="institution_short_name"
                tooltip="Versión abreviada del nombre (se usa en encabezados, reportes y constancias)"
              >
                <Input
                  placeholder="Ej: U.E. Colegio Batalla"
                  className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                />
              </Form.Item>

              <Form.Item
                label={<span className="text-[var(--color-text-main)] font-bold">Código DEA de la Institución</span>}
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
                label={<span className="text-[var(--color-text-main)] font-bold">Nombre del Director</span>}
                name="director_name"
                tooltip="Nombre corto del director (se usa en Resumen de Rendimiento y Constancias)"
              >
                <Input
                  placeholder="Nombre completo del director"
                  className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                  onChange={(e) => setDirectorName(e.target.value)}
                />
              </Form.Item>

              <Form.Item
                label={<span className="text-[var(--color-text-main)] font-bold">Nombres del Director (formato largo)</span>}
                name="director_first_names"
                tooltip="Nombres del director para Notas Certificadas (formato: Apellidos, Nombres)"
              >
                <Input
                  placeholder="Ej: Magdalena Coromoto"
                  className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                  onChange={(e) => setDirectorFirstNames(e.target.value)}
                />
              </Form.Item>

              <Form.Item
                label={<span className="text-[var(--color-text-main)] font-bold">Apellidos del Director (formato largo)</span>}
                name="director_last_names"
                tooltip="Apellidos del director para Notas Certificadas (formato: Apellidos, Nombres)"
              >
                <Input
                  placeholder="Ej: Torres de Herrera"
                  className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                  onChange={(e) => setDirectorLastNames(e.target.value)}
                />
              </Form.Item>

              <Form.Item
                label={<span className="text-[var(--color-text-main)] font-bold">Cédula del Director</span>}
                name="director_document"
              >
                <Input
                  placeholder="V-12345678"
                  className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                  onChange={(e) => setDirectorDocument(e.target.value)}
                />
              </Form.Item>

              <Form.Item
                label={<span className="text-[var(--color-text-main)] font-bold">Género del Director</span>}
                name="director_gender"
                tooltip="Determina si en los documentos se muestra 'El Director' o 'La Directora'"
              >
                <Segmented
                  block
                  value={directorGender}
                  onChange={(val: 'M' | 'F') => {
                    setDirectorGender(val);
                    form.setFieldsValue({ director_gender: val });
                  }}
                  options={[
                    { label: 'Masculino (El Director)', value: 'M' },
                    { label: 'Femenino (La Directora)', value: 'F' },
                  ]}
                  className="rounded-xl p-1"
                />
              </Form.Item>

              <Form.Item
                label={<span className="text-[var(--color-text-main)] font-bold">Dirección de la Institución</span>}
                name="institution_address"
              >
                <Input
                  placeholder="Ej: Calle José Martí Nro 4 - Altagracia de Orituco - Estado Guárico"
                  className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                />
              </Form.Item>

              <Form.Item
                label={<span className="text-[var(--color-text-main)] font-bold">Estado / Entidad Federal</span>}
                name="institution_state"
                tooltip="Estado donde se ubica la institución."
              >
                <AutoComplete
                  options={stateOptions}
                  placeholder="Ej: Guárico"
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  onChange={(value) => {
                    updateMunicipalityOptions(value);
                    form.setFieldValue('institution_municipality', '');
                    form.setFieldValue('institution_parish', '');
                    setParishOptions([]);
                  }}
                  className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                />
              </Form.Item>

              <Form.Item
                label={<span className="text-[var(--color-text-main)] font-bold">Municipio de la Institución</span>}
                name="institution_municipality"
                tooltip="Municipio donde se ubica la institución. Se usa en el resumen de rendimiento (named range: inst_municipality)."
              >
                <AutoComplete
                  options={municipalityOptions}
                  placeholder="Seleccione primero el estado"
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  disabled={municipalityOptions.length === 0}
                  onChange={(value) => {
                    updateParishOptions(value);
                    form.setFieldValue('institution_parish', '');
                  }}
                  className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                />
              </Form.Item>

              <Form.Item
                label={<span className="text-[var(--color-text-main)] font-bold">Parroquia de la Institución</span>}
                name="institution_parish"
                tooltip="Parroquia donde se ubica la institución."
              >
                <AutoComplete
                  options={parishOptions}
                  placeholder="Seleccione primero el municipio"
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  disabled={parishOptions.length === 0}
                  className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                />
              </Form.Item>

              <Form.Item
                label={<span className="text-[var(--color-text-main)] font-bold">Teléfono de la Institución</span>}
                name="institution_phone"
              >
                <Input
                  placeholder="Ej: 0238 - 3340709"
                  className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                />
              </Form.Item>

<Form.Item
                label={<span className="text-[var(--color-text-main)] font-bold">CDCEE</span>}
                name="institution_cdcee"
                tooltip="Circuito de Desarrollo Comunal Educativo Ecclesial"
              >
                <Input
                  placeholder="Ej: GuA�rico"
                  className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                />
              </Form.Item>

              <Form.Item
                label={<span className="text-[var(--color-text-main)] font-bold">Código de modalidad de estudios</span>}
                name="institution_code"
                tooltip="Código de modalidad de estudios según el MPPE (ej. 31059)"
              >
                <Input
                  placeholder="Ej: 31059"
                  className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                />
              </Form.Item>

              <Form.Item
                label={<span className="text-[var(--color-text-main)] font-bold">Modalidad de estudio</span>}
                name="institution_level"
                tooltip="Nivel educativo del plantel (se muestra en el resumen de rendimiento)"
              >
                <Input
                  placeholder="Ej: EDUCACIÓN MEDIA GENERAL"
                  className="h-12 border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 rounded-xl transition-all"
                />
              </Form.Item>

              <Form.Item
                label={<span className="text-[var(--color-text-main)] font-bold">Forma del Logo</span>}
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
                  className="rounded-xl p-1"
                />
              </Form.Item>

              <Form.Item
                label={<span className="text-[var(--color-text-main)] font-bold">Formato de Hora</span>}
                name="time_format"
                tooltip="Define cómo se muestran las horas en todo el sistema (ej: 14:30 o 02:30 PM)"
              >
                <Segmented
                  block
                  options={[
                    { label: '24 horas (14:30)', value: '24', icon: <ClockCircleOutlined /> },
                    { label: '12 horas (02:30 PM)', value: '12' },
                  ]}
                  className="rounded-xl p-1"
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
              <span className="text-[var(--color-text-main)] font-bold block mb-2">Escudo / Logo Oficial</span>
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

                  api.post('/upload/logo', formData)
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
                className="!rounded-3xl !border-none bg-slate-100/30 transition-all overflow-hidden"
              >
                {logoPreview ? (
                  <div className="p-4 relative group h-48 flex flex-col items-center justify-center">
                    <img
                      src={logoPreview}
                      alt="Preview"
                      className={`max-h-full max-w-full object-contain drop-shadow-2xl translate-y-2 group-hover:scale-110 transition-transform duration-500 ${form.getFieldValue('institution_logo_shape') === 'circle' ? 'rounded-full' : 'rounded-xl'}`}
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                      <div className="bg-white px-4 py-2 rounded-xl text-[var(--color-text-main)] font-black text-[10px] uppercase tracking-widest shadow-xl">Cambiar Logo</div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 space-y-4">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm mx-auto flex items-center justify-center">
                      <UploadOutlined className="text-3xl text-brand-primary" />
                    </div>
                    <div className="text-center mt-4">
                    <p className="text-[var(--color-text-main)] font-bold">Haz clic o arrastra el logo</p>
                    <p className="text-[var(--color-text-muted)] text-xs mt-1">PNG, JPG hasta 5MB</p>
                  </div>
                  </div>
                )}
              </Upload.Dragger>
            </div>
          </div>

            <div className="mt-8">
              <div className="theme-panel-header px-12 py-8 rounded-t-2xl mx-[-48px]">
                <h2 className="text-[var(--color-header-text)] text-xl font-bold">Apariencia y Colores</h2>
                <p className="text-[var(--color-header-text)]/60 text-xs font-medium uppercase tracking-widest mt-1">Configuración del Tema Global</p>
              </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 py-8">
              {/* Warnings Color */}
              <div>
                <label className="text-[var(--color-text-main)] font-bold block mb-2">Color de Advertencias</label>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">Alertas y estados críticos.</p>
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
                    <span className="text-sm font-bold text-[var(--color-text-main)] uppercase tracking-wider">{primaryColor}</span>
                    <div className="h-2 w-24 rounded-full" style={{ backgroundColor: primaryColor }} />
                  </div>
                </div>
              </div>

              {/* Inactive Color */}
              <div>
                <label className="text-[var(--color-text-main)] font-bold block mb-2">Color Inactivo</label>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">Estados desactivados, tabs inactivos y bordes tenues.</p>
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
                    <span className="text-sm font-bold text-[var(--color-text-main)] uppercase tracking-wider">{secondaryColor}</span>
                    <div className="h-2 w-24 rounded-full" style={{ backgroundColor: secondaryColor }} />
                  </div>
                </div>
              </div>

              {/* Brand Secondary Color */}
              <div>
                <label className="text-[var(--color-text-main)] font-bold block mb-2">Color Secundario</label>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">Color de marca secundario para variaciones visuales.</p>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={brandSecondaryColor}
                    onChange={(e) => {
                      setBrandSecondaryColor(e.target.value);
                      form.setFieldsValue({ theme_brand_secondary: e.target.value });
                    }}
                    className="h-12 w-16 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5 bg-white"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-[var(--color-text-main)] uppercase tracking-wider">{brandSecondaryColor}</span>
                    <div className="h-2 w-24 rounded-full" style={{ backgroundColor: brandSecondaryColor }} />
                  </div>
                </div>
              </div>

              {/* Text Color */}
              <div>
                <label className="text-[var(--color-text-main)] font-bold block mb-2">Texto Base</label>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">Color base del texto de la app.</p>
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
                    <span className="text-sm font-bold text-[var(--color-text-main)] uppercase tracking-wider">{textColor}</span>
                    <div className="h-2 w-24 rounded-full" style={{ backgroundColor: textColor }} />
                  </div>
                </div>
              </div>

              {/* Sidebar Color */}
              <div>
                <label className="text-[var(--color-text-main)] font-bold block mb-2">Barra Lateral</label>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">Color de fondo para el menú principal lateral.</p>
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
                    <span className="text-sm font-bold text-[var(--color-text-main)] uppercase tracking-wider">{sidebarColor}</span>
                    <div className="h-2 w-24 rounded-full" style={{ backgroundColor: sidebarColor }} />
                  </div>
                </div>
              </div>

              {/* Page Background */}
              <div>
                <label className="text-[var(--color-text-main)] font-bold block mb-2">Fondo de Página</label>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">Color de fondo global del layout.</p>
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
                    <span className="text-sm font-bold text-[var(--color-text-main)] uppercase tracking-wider">{pageBgColor}</span>
                    <div className="h-2 w-24 rounded-full" style={{ backgroundColor: pageBgColor }} />
                  </div>
                </div>
              </div>

              {/* Panel Header */}
              <div>
                <label className="text-[var(--color-text-main)] font-bold block mb-2">Encabezado de Panel</label>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">Fondo para los títulos superiores en cada vista.</p>
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
                    <span className="text-sm font-bold text-[var(--color-text-main)] uppercase tracking-wider">{panelHeaderColor}</span>
                    <div className="h-2 w-24 rounded-full" style={{ backgroundColor: panelHeaderColor }} />
                  </div>
                </div>
              </div>

              {/* Content Background */}
              <div>
                <label className="text-[var(--color-text-main)] font-bold block mb-2">Fondo de Contenido</label>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">Fondo de las tarjetas blancas (tablas, formularios).</p>
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
                    <span className="text-sm font-bold text-[var(--color-text-main)] uppercase tracking-wider">{contentBgColor}</span>
                    <div className="h-2 w-24 rounded-full" style={{ border: '1px solid #ccc', backgroundColor: contentBgColor }} />
                  </div>
                </div>
              </div>

              {/* Accent Color */}
              <div>
                <label className="text-[var(--color-text-main)] font-bold block mb-2">Encabezado Secundario</label>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">Detalles sutiles e iconos decorativos.</p>
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
                    <span className="text-sm font-bold text-[var(--color-text-main)] uppercase tracking-wider">{accentColor}</span>
                    <div className="h-2 w-24 rounded-full" style={{ backgroundColor: accentColor }} />
                  </div>
                </div>
              </div>

              {/* Header Text Color */}
              <div>
                <label className="text-[var(--color-text-main)] font-bold block mb-2">Textos sobre Oscuros</label>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">Color de texto en Encabezados y Barra Lateral.</p>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={headerTextColor}
                    onChange={(e) => {
                      setHeaderTextColor(e.target.value);
                      form.setFieldsValue({ theme_header_text_color: e.target.value });
                    }}
                    className="h-12 w-16 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5 bg-white"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-[var(--color-text-main)] uppercase tracking-wider">{headerTextColor}</span>
                    <div className="h-2 w-24 rounded-full" style={{ backgroundColor: headerTextColor, border: '1px solid #ccc' }} />
                  </div>
                </div>
              </div>

              {/* Input Background Color */}
              <div>
                <label className="text-[var(--color-text-main)] font-bold block mb-2">Campos de Texto</label>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">Color de fondo para los inputs y selects.</p>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={inputBgColor}
                    onChange={(e) => {
                      setInputBgColor(e.target.value);
                      form.setFieldsValue({ theme_input_bg: e.target.value });
                    }}
                    className="h-12 w-16 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5 bg-white"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-[var(--color-text-main)] uppercase tracking-wider">{inputBgColor}</span>
                    <div className="h-2 w-24 rounded-full" style={{ backgroundColor: inputBgColor, border: '1px solid #ccc' }} />
                  </div>
                </div>
                </div>
              </div>

              {/* Muted Text Color */}
              <div>
                <label className="text-[var(--color-text-main)] font-bold block mb-2">Texto Secundario</label>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">Color para textos secundarios, descripciones, bordes de tabla, líneas divisorias y ayudas visuales.</p>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={mutedTextColor}
                    onChange={(e) => {
                      setMutedTextColor(e.target.value);
                      form.setFieldsValue({ theme_muted_text_color: e.target.value });
                    }}
                    className="h-12 w-16 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5 bg-white"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-[var(--color-text-main)] uppercase tracking-wider">{mutedTextColor}</span>
                    <div className="h-2 w-24 rounded-full" style={{ backgroundColor: mutedTextColor, border: '1px solid #ccc' }} />
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
              Guardar Identidad
            </Button>
          </div>
            </Form>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SettingsManagement;
