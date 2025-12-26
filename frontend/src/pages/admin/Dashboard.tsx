import React from 'react';
import { Row, Col, Card, Button } from 'antd';
import {
  BarChartOutlined,
  SafetyCertificateOutlined,
  UserAddOutlined,
  DatabaseOutlined,
  CloudUploadOutlined,
  ArrowsAltOutlined
} from '@ant-design/icons';

const AdminDashboard: React.FC = () => {
  const quickActions = [
    { title: 'Inscribir Alumno', icon: <UserAddOutlined />, color: 'bg-indigo-500' },
    { title: 'Cargar Nómina', icon: <CloudUploadOutlined />, color: 'bg-blue-500' },
    { title: 'Auditoría', icon: <SafetyCertificateOutlined />, color: 'bg-emerald-500' },
    { title: 'Respaldar BD', icon: <DatabaseOutlined />, color: 'bg-slate-700' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Consola de Administración</h1>
          <p className="text-slate-500 font-medium">Control total sobre los parámetros operativos y humanos de la institución.</p>
        </div>
        <div className="flex gap-2">
          <Button icon={<ArrowsAltOutlined />} className="rounded-xl font-bold">Maximizar</Button>
          <Button type="primary" className="rounded-xl font-bold bg-slate-900">Configuración Global</Button>
        </div>
      </div>

      {/* Hero Stats */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={18}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Usuarios Activos', val: '1,204', sub: '+42 hoy' },
              { label: 'Inscripciones Solicitadas', val: '156', sub: '24 pendientes' },
              { label: 'Eficacia Operativa', val: '98.2%', sub: 'Nivel Óptimo' },
            ].map((s, i) => (
              <div key={i} className="glass-card p-6 border-none bg-gradient-to-br from-white to-slate-50/50">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">{s.label}</span>
                <h2 className="text-4xl font-black text-slate-900 mt-2">{s.val}</h2>
                <div className="flex items-center gap-1 mt-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-bold text-slate-500">{s.sub}</span>
                </div>
              </div>
            ))}
          </div>

          <Card className="glass-card mt-6 h-80 flex flex-col items-center justify-center border-dashed border-2 border-slate-200 bg-transparent">
            <BarChartOutlined className="text-5xl text-slate-200 mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Módulo Analítico en Tiempo Real</p>
            <span className="text-slate-400 text-[10px] mt-1 font-medium italic">Gráficos de rendimiento en desarrollo...</span>
          </Card>
        </Col>

        <Col xs={24} lg={6}>
          <h3 className="text-slate-900 font-black uppercase tracking-widest text-[10px] mb-4">Acciones Críticas</h3>
          <div className="grid grid-cols-1 gap-4">
            {quickActions.map((a, i) => (
              <div key={i} className="group p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:border-brand-primary/20 transition-all cursor-pointer flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${a.color} text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-500/10 group-hover:scale-110 transition-transform`}>
                  {a.icon}
                </div>
                <span className="font-bold text-slate-700 group-hover:text-brand-primary transition-colors">{a.title}</span>
              </div>
            ))}
          </div>

          <Card className="mt-8 bg-brand-primary border-none rounded-3xl p-6 text-white shadow-2xl shadow-blue-500/40 relative overflow-hidden">
            <div className="relative z-10">
              <h4 className="font-black text-xl leading-tight">Soporte Técnico Premium</h4>
              <p className="text-white/70 text-sm mt-2 font-medium">¿Necesitas ayuda con la plataforma?</p>
              <Button className="mt-6 w-full h-11 bg-white text-brand-primary font-bold border-none rounded-xl">Contactar ahora</Button>
            </div>
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdminDashboard;
