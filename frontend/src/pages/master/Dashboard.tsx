import { Row, Col, Card, Button, Tag } from 'antd';
import {
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  CloudServerOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';

const MasterDashboard: React.FC = () => {
  const systemMetrics = [
    { label: 'Uptime del Servidor', val: '99.9%', sub: 'Estado: Óptimo', color: 'text-emerald-500', icon: <CloudServerOutlined /> },
    { label: 'Base de Datos', val: '2.4 GB', sub: 'Último respaldo: Hoy 4:00 AM', color: 'text-blue-500', icon: <DatabaseOutlined /> },
    { label: 'Tráfico de Red', val: '14 ms', sub: 'Latencia promedio', color: 'text-brand-primary', icon: <ThunderboltOutlined /> },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Welcome */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-8 md:p-12 text-white shadow-2xl">
        <div className="relative z-10 space-y-4 max-w-2xl">
          <Tag color="gold" className="border-none font-bold uppercase tracking-widest text-[10px] px-3 py-1 rounded-full">Acceso de Súper Usuario</Tag>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none">Control Maestro del Ecosistema Académico</h1>
          <p className="text-slate-400 text-lg font-medium">Bienvenido al núcleo del sistema. Desde aquí supervisas la integridad, el rendimiento y la configuración global de la plataforma.</p>
          <div className="pt-4 flex flex-wrap gap-4">
            <Button type="primary" size="large" className="bg-white text-slate-900 border-none font-bold rounded-2xl h-12 px-8 flex items-center gap-2 group">
              Monitor de Salud <ArrowRightOutlined className="group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button ghost size="large" className="border-white/20 text-white font-bold rounded-2xl h-12 px-8">Ver Registros de Auditoría</Button>
          </div>
        </div>
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-brand-primary/20 to-transparent pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl" />
      </div>

      {/* Hardware / System Stats */}
      <Row gutter={[24, 24]}>
        {systemMetrics.map((m, i) => (
          <Col xs={24} md={8} key={i}>
            <Card className="glass-card border-none hover:shadow-2xl transition-all group overflow-hidden">
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-2xl ${m.color} group-hover:scale-110 transition-transform shadow-inner`}>
                  {m.icon}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{m.label}</p>
                  <h3 className="text-3xl font-black text-slate-900 leading-none">{m.val}</h3>
                  <p className="text-[11px] text-slate-500 font-bold mt-2">{m.sub}</p>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card
            title={<div className="flex items-center gap-2 font-bold text-slate-800"><GlobalOutlined /> Tráfico Global del Sistema</div>}
            className="glass-card h-80"
            extra={<Button type="link">Analíticas Avanzadas</Button>}
          >
            <div className="flex h-full items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
              <span className="text-slate-300 font-bold uppercase tracking-widest text-xs">Visualización de tráfico global...</span>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={<div className="flex items-center gap-2 font-bold text-slate-800"><SafetyCertificateOutlined /> Seguridad & Parches</div>}
            className="glass-card h-80 bg-gradient-to-br from-indigo-50/50 to-white"
          >
            <div className="space-y-4">
              {[
                { label: 'SSL Certificate', status: 'Válido (320 días)' },
                { label: 'Firewall Institucional', status: 'Activo' },
                { label: 'Parches de Seguridad', status: 'Al día' },
              ].map((s, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-white shadow-sm border border-slate-100">
                  <span className="text-sm font-bold text-slate-700">{s.label}</span>
                  <Tag color="success" className="rounded-full border-none font-bold text-[10px]">OK</Tag>
                </div>
              ))}
              <div className="pt-4">
                <Button block className="h-11 rounded-xl font-bold bg-slate-900 text-white border-none shadow-lg">Ejecutar Diagnóstico Global</Button>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MasterDashboard;
