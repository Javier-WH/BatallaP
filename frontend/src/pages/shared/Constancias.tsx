import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import api from '@/services/api';
import { Button, Select, Input, message, Spin, Modal, Empty, Tabs, Card } from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  FilePdfOutlined, FileWordOutlined, ArrowLeftOutlined, SaveOutlined,
} from '@ant-design/icons';
import ConstanciaEditor from './ConstanciaEditor';
import type { VariableDef } from './ConstanciaEditor';

interface Template {
  id: number;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface Student {
  id: number;
  firstName: string;
  lastName: string;
  document: string;
  documentType: string;
}

const Constancias: React.FC = () => {
  const { user } = useAuth();
  const { activePeriod } = useSchool();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'generate' | 'templates'>('generate');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [variables, setVariables] = useState<VariableDef[]>([]);
  const [loading, setLoading] = useState(false);

  // Generate tab state
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [templateAnalysis, setTemplateAnalysis] = useState<{ needsStudent: boolean; customVars: string[] } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Template editor tab state
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);

  const canEdit = user?.roles.some(r => ['Master', 'Administrador', 'Control de Estudios'].includes(r));

  // Fetch templates + variables
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tplRes, varRes] = await Promise.all([
        api.get('/constancias'),
        api.get('/constancias/variables'),
      ]);
      setTemplates(tplRes.data);
      setVariables(varRes.data);
    } catch (error) {
      console.error('Error fetching constancia data:', error);
      message.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // When template is selected, analyze what inputs it needs
  const handleTemplateSelect = useCallback(async (templateId: number) => {
    setSelectedTemplateId(templateId);
    setPreviewHtml(null);
    setSelectedStudent(null);
    setCustomValues({});
    setTemplateAnalysis(null);
    setAnalyzing(true);
    try {
      const res = await api.get(`/constancias/analyze/${templateId}`);
      setTemplateAnalysis(res.data);
    } catch {
      // If analysis fails, assume it needs student
      setTemplateAnalysis({ needsStudent: true, customVars: [] });
    } finally {
      setAnalyzing(false);
    }
  }, []);

  // Search students (uses /users/search and filters by Alumno role client-side)
  const searchStudents = useCallback(async (query: string) => {
    if (query.trim().length < 2) { setSearchResults([]); return; }
    try {
      const res = await api.get('/users', { params: { q: query, activeOnly: true } });
      // Filter to students only
      const students = (res.data?.data || res.data || [])
        .filter((u: any) => u.roles?.some((r: any) => r.name === 'Alumno'))
        .map((u: any) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          document: u.document || '',
          documentType: u.documentType || '',
        }));
      setSearchResults(students);
    } catch {
      setSearchResults([]);
    }
  }, []);

  // Generate preview
  const generatePreview = useCallback(async () => {
    if (!selectedTemplateId) { message.warning('Seleccione una plantilla'); return; }
    if (templateAnalysis?.needsStudent && !selectedStudent) { message.warning('Seleccione un estudiante'); return; }
    setGenerating(true);
    try {
      const res = await api.post('/constancias/preview', {
        templateId: selectedTemplateId,
        personId: selectedStudent?.id || null,
        schoolPeriodId: activePeriod?.id || null,
        customVars: customValues,
      });
      setPreviewHtml(res.data.html);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Error al generar vista previa');
    } finally {
      setGenerating(false);
    }
  }, [selectedTemplateId, selectedStudent, activePeriod, customValues, templateAnalysis]);

  // Print PDF (uses browser print)
  const handlePrintPdf = useCallback(() => {
    if (!previewHtml) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { message.error('Permita popups para imprimir'); return; }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Constancia</title>
        <style>
          @page { margin: 2cm; }
          body { font-family: 'Times New Roman', serif; font-size: 14px; line-height: 1.6; }
        </style>
      </head>
      <body>${previewHtml}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 300);
  }, [previewHtml]);

  // Export to Word (HTML → .doc)
  const handleExportWord = useCallback(() => {
    if (!previewHtml) return;
    const header = `<!DOCTYPE html><html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Constancia</title></head><body>`;
    const footer = '</body></html>';
    const sourceHTML = header + previewHtml + footer;
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement('a');
    fileDownload.href = source;
    fileDownload.download = 'constancia.doc';
    fileDownload.click();
  }, [previewHtml]);

  // Template CRUD
  const handleNewTemplate = () => {
    setTemplateName('');
    setTemplateContent('');
    setEditingTemplate(null);
    setShowNameModal(true);
  };

  const handleEditTemplate = async (tpl: Template) => {
    try {
      const res = await api.get(`/constancias/${tpl.id}`);
      const full = res.data;
      setEditingTemplate(full);
      setTemplateName(full.name);
      setTemplateContent(full.content || '');
      setActiveTab('templates');
    } catch {
      message.error('Error al cargar la plantilla');
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) { message.warning('Ingrese un nombre'); return; }
    setSaving(true);
    try {
      if (editingTemplate && editingTemplate.id !== 0) {
        await api.put(`/constancias/${editingTemplate.id}`, { name: templateName.trim(), content: templateContent });
        message.success('Plantilla actualizada');
      } else {
        await api.post('/constancias', { name: templateName.trim(), content: templateContent });
        message.success('Plantilla creada');
      }
      setShowNameModal(false);
      setEditingTemplate(null);
      setTemplateName('');
      setTemplateContent('');
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (tpl: Template) => {
    Modal.confirm({
      title: '¿Eliminar plantilla?',
      content: `Se eliminará "${tpl.name}"`,
      okText: 'Eliminar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await api.delete(`/constancias/${tpl.id}`);
          message.success('Plantilla eliminada');
          fetchData();
        } catch {
          message.error('Error al eliminar');
        }
      },
    });
  };

  // ── Generate Tab ──
  const generateTab = (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <Card title="Generar Constancia" className="shadow-sm">
        <div className="space-y-4">
          {/* Step 1: Template selection */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              1. Tipo de constancia
            </label>
            <Select
              className="w-full"
              placeholder="Seleccione el tipo de constancia…"
              value={selectedTemplateId ?? undefined}
              onChange={(v) => handleTemplateSelect(v)}
              options={templates.map(t => ({ value: t.id, label: t.name }))}
              size="large"
              loading={loading}
            />
          </div>

          {/* Step 2: Dynamic inputs based on template analysis */}
          {analyzing && (
            <div className="text-center py-4"><Spin tip="Analizando plantilla…" /></div>
          )}

          {templateAnalysis && !analyzing && (
            <>
              {/* Student search — only if template uses student variables */}
              {templateAnalysis.needsStudent && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    2. Estudiante
                  </label>
                  <Select
                    className="w-full"
                    showSearch
                    placeholder="Buscar por nombre o cédula…"
                    value={selectedStudent?.id}
                    onSearch={searchStudents}
                    onChange={(v) => {
                      const s = searchResults.find(s => s.id === v);
                      setSelectedStudent(s || null);
                      setPreviewHtml(null);
                    }}
                    filterOption={false}
                    options={searchResults.map(s => ({
                      value: s.id,
                      label: `${s.firstName} ${s.lastName} — ${s.documentType} ${s.document}`,
                    }))}
                    size="large"
                    allowClear
                  />
                </div>
              )}

              {/* Custom text inputs — for each custom.* variable in the template */}
              {templateAnalysis.customVars.length > 0 && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-600">
                    {templateAnalysis.needsStudent ? '3. ' : '2. '} Datos adicionales
                  </label>
                  {templateAnalysis.customVars.map(varName => (
                    <div key={varName}>
                      <label className="block text-xs text-slate-500 mb-1 capitalize">
                        {varName.replace(/_/g, ' ')}
                      </label>
                      <Input
                        value={customValues[varName] || ''}
                        onChange={e => {
                          setCustomValues(prev => ({ ...prev, [varName]: e.target.value }));
                          setPreviewHtml(null);
                        }}
                        placeholder={`Ingrese ${varName.replace(/_/g, ' ')}…`}
                        size="large"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Generate button */}
              <Button
                type="primary"
                size="large"
                icon={<EyeOutlined />}
                onClick={generatePreview}
                disabled={(templateAnalysis.needsStudent && !selectedStudent) || generating}
                loading={generating}
              >
                Generar vista previa
              </Button>
            </>
          )}

          {!selectedTemplateId && !loading && (
            <div className="text-center py-8 text-slate-400">
              Seleccione un tipo de constancia para comenzar
            </div>
          )}
        </div>
      </Card>

      {/* Preview */}
      {previewHtml && (
        <Card
          title="Vista previa"
          extra={
            <div className="flex gap-2">
              <Button icon={<FilePdfOutlined />} onClick={handlePrintPdf}>PDF</Button>
              <Button icon={<FileWordOutlined />} onClick={handleExportWord}>Word</Button>
            </div>
          }
          className="shadow-sm"
        >
          <div
            className="bg-white border border-slate-200 p-8 min-h-[400px]"
            style={{ fontFamily: "'Times New Roman', serif" }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </Card>
      )}
    </div>
  );

  // ── Templates Tab ──
  const templatesTab = (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {editingTemplate ? (
        <Card
          title={
            <div className="flex items-center gap-3">
              <Button icon={<ArrowLeftOutlined />} onClick={() => { setEditingTemplate(null); setTemplateName(''); setTemplateContent(''); }}>Volver</Button>
              <Input
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                style={{ width: 300 }}
                placeholder="Nombre de la plantilla"
              />
            </div>
          }
          extra={
            <div className="flex gap-2">
              <Button icon={<SaveOutlined />} type="primary" onClick={handleSaveTemplate} loading={saving}>Guardar</Button>
            </div>
          }
        >
          <ConstanciaEditor
            content={templateContent}
            onChange={setTemplateContent}
            variables={variables}
          />
        </Card>
      ) : (
        <Card
          title="Plantillas de Constancias"
          extra={canEdit && <Button icon={<PlusOutlined />} type="primary" onClick={handleNewTemplate}>Nueva plantilla</Button>}
          className="shadow-sm"
        >
          {loading ? (
            <div className="text-center py-8"><Spin /></div>
          ) : templates.length === 0 ? (
            <Empty description="No hay plantillas creadas" />
          ) : (
            <div className="space-y-2">
              {templates.map(tpl => (
                <div
                  key={tpl.id}
                  className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <div className="font-medium text-slate-800">{tpl.name}</div>
                    <div className="text-xs text-slate-400">
                      Actualizada: {new Date(tpl.updatedAt).toLocaleDateString('es-ES')}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button icon={<EditOutlined />} onClick={() => handleEditTemplate(tpl)}>Editar</Button>
                    {canEdit && (
                      <Button icon={<DeleteOutlined />} danger onClick={() => handleDeleteTemplate(tpl)}>Eliminar</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">Constancias</h1>
        </div>
      </div>
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'generate' | 'templates')}
        items={[
          { key: 'generate', label: 'Generar Constancia', children: generateTab },
          { key: 'templates', label: 'Plantillas', children: templatesTab },
        ]}
        className="constancias-tabs"
        tabBarStyle={{ paddingLeft: 24, marginBottom: 0 }}
      />

      {/* New template name modal */}
      <Modal
        title="Nueva plantilla"
        open={showNameModal}
        onOk={() => {
          if (!templateName.trim()) { message.warning('Ingrese un nombre'); return; }
          setShowNameModal(false);
          setEditingTemplate({ id: 0, name: '', content: '', createdAt: '', updatedAt: '' } as any);
        }}
        onCancel={() => setShowNameModal(false)}
        okText="Crear"
        cancelText="Cancelar"
      >
        <Input
          value={templateName}
          onChange={e => setTemplateName(e.target.value)}
          placeholder="Ej: Constancia de Estudios"
          autoFocus
          onPressEnter={() => {
            if (!templateName.trim()) { message.warning('Ingrese un nombre'); return; }
            setShowNameModal(false);
            setEditingTemplate({ id: 0, name: '', content: '', createdAt: '', updatedAt: '' } as any);
          }}
        />
      </Modal>
    </div>
  );
};

export default Constancias;
