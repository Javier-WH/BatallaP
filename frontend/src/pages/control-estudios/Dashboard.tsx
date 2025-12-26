import { Row, Col, Card, Tag, Button } from 'antd';
import {
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ArrowUpOutlined,
  FileTextOutlined,
  TeamOutlined
} from '@ant-design/icons';

const ControlEstudiosDashboard: React.FC = () => {
  // Mock data for visual appeal
  const stats = [
    { title: 'Estudiantes Inscritos', value: 842, icon: <TeamOutlined />, color: '#1e40af', trend: '+12% este mes' },
    { title: 'Carga Académica', value: '94%', icon: <FileTextOutlined />, color: '#0ea5e9', trend: 'Periodo 2025-I' },
    { title: 'Pendientes Matrícula', value: 24, icon: <ClockCircleOutlined />, color: '#f59e0b', trend: 'Acción requerida' },
    { title: 'Calificaciones Listas', value: '82%', icon: <CheckCircleOutlined />, color: '#10b981', trend: 'Actualizado hoy' },
  ];

  const recentActivity = [
    { id: 1, student: 'Ana García', action: 'Inscripción Completada', date: 'Hace 5 min', status: 'success' },
    { id: 2, student: 'Luis Torres', action: 'Cambio de Sección', date: 'Hace 12 min', status: 'processing' },
    { id: 3, student: 'María Rivas', action: 'Actualización de Datos', date: 'Hace 1 hora', status: 'default' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900 leading-tight">Módulo de Control de Estudios</h1>
        <p className="text-slate-500 font-medium">Resumen general y estado de la gestión académica institucional.</p>
      </div>

      {/* Stats Grid */}
      <Row gutter={[24, 24]}>
        {stats.map((stat, idx) => (
          <Col xs={24} sm={12} lg={6} key={idx}>
            <Card className="glass-card hover:translate-y-[-4px] transition-all duration-300">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">{stat.title}</p>
                  <h3 className="text-3xl font-black text-slate-900">{stat.value}</h3>
                  <p className="text-[10px] items-center gap-1 mt-2 flex font-bold" style={{ color: stat.color }}>
                    <ArrowUpOutlined /> {stat.trend}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                  {stat.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[24, 24]}>
        {/* Main Chart Area Placeholder */}
        <Col xs={24} lg={16}>
          <Card
            title={<span className="text-slate-800 font-bold">Distribución por Grados</span>}
            className="glass-card h-full"
            extra={<Button type="link">Ver Detalles</Button>}
          >
            <div className="flex items-end justify-between h-64 gap-4 px-4">
              {[65, 45, 85, 30, 95, 60].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="w-full bg-slate-100 rounded-t-xl relative overflow-hidden h-full">
                    <div
                      className="absolute bottom-0 w-full bg-gradient-to-t from-brand-primary to-brand-secondary transition-all duration-1000 group-hover:brightness-110"
                      style={{ height: `${h}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 capitalize">{i + 1}° Año</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        {/* Sidebar Activity */}
        <Col xs={24} lg={8}>
          <Card
            title={<span className="text-slate-800 font-bold">Actividad Reciente</span>}
            className="glass-card h-full"
          >
            <div className="space-y-6">
              {recentActivity.map(act => (
                <div key={act.id} className="flex gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                    <UserOutlined />
                  </div>
                  <div className="flex-1 flex flex-col min-w-0">
                    <span className="text-sm font-bold text-slate-800 truncate">{act.student}</span>
                    <span className="text-[11px] text-slate-500 font-medium">{act.action}</span>
                    <span className="text-[10px] text-slate-400 mt-1">{act.date}</span>
                  </div>
                  <Tag color={act.status} className="h-fit rounded-lg border-none font-bold text-[10px] px-2">
                    {act.status === 'success' ? 'Listo' : 'Pendiente'}
                  </Tag>
                </div>
              ))}
            </div>
            <Button className="w-full mt-8 rounded-xl font-bold text-slate-600 border-slate-200">Ver todo el historial</Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ControlEstudiosDashboard;
