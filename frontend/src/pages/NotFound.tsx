import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined, HomeOutlined, SearchOutlined } from '@ant-design/icons';
import { useSchool } from '@/context/SchoolContext';

const FLOATING_ITEMS = [
  { emoji: '📚', top: '12%', left: '8%', size: '2.5rem', delay: '0s' },
  { emoji: '✏️', top: '22%', right: '10%', size: '2rem', delay: '1.2s' },
  { emoji: '🎒', top: '60%', left: '6%', size: '2.8rem', delay: '0.6s' },
  { emoji: '📐', top: '70%', right: '14%', size: '2.2rem', delay: '2s' },
  { emoji: '🔔', top: '38%', left: '4%', size: '2rem', delay: '2.8s' },
  { emoji: '📝', top: '15%', right: '30%', size: '1.8rem', delay: '0.6s' },
  { emoji: '🎒', top: '80%', right: '18%', size: '2rem', delay: '1.8s' },
  { emoji: '🧮', top: '45%', right: '4%', size: '2rem', delay: '3.2s' },
];

const NOT_FOUND_MESSAGES = [
  {
    title: 'Esta página se perdió en el campus',
    description: 'Parece que se saltó la clase de Geografía y no encuentra su salón.',
    hint: 'Revisa la ruta o vuelve al panel principal para continuar.',
  },
  {
    title: 'Ups, esta ruta salió de recreo',
    description: 'Buscamos en todos los salones, pero no encontramos lo que venías a buscar.',
    hint: 'Tal vez la página cambió de aula o necesita una ruta diferente.',
  },
  {
    title: 'La página no llegó a clases',
    description: 'El enlace existe en el horario, pero hoy no se presentó en el campus.',
    hint: 'Vuelve al inicio y prueba desde allí.',
  },
  {
    title: 'Aquí no hay nada que calificar',
    description: 'La dirección solicitada no forma parte del mapa académico actual.',
    hint: 'Comprueba la dirección o solicita ayuda a Control de Estudios.',
  },
  {
    title: 'Este salón está vacío',
    description: 'La página que buscas pudo haberse mudado, archivado o tomado el día libre.',
    hint: 'Regresa a un lugar conocido para seguir navegando.',
  },
  {
    title: 'La brújula perdió el norte',
    description: 'No pudimos encontrar esta página dentro del campus digital.',
    hint: 'Usa uno de los botones para retomar el camino.',
  },
];

const getRandomMessage = () => NOT_FOUND_MESSAGES[Math.floor(Math.random() * NOT_FOUND_MESSAGES.length)];

const NotFound = () => {
  const navigate = useNavigate();
  const { settings } = useSchool();
  const [message] = useState(getRandomMessage);

  return (
    <div className="nf-page">
      <div className="nf-background" aria-hidden>
        <div className="nf-orb nf-orb-top" />
        <div className="nf-orb nf-orb-bottom" />
        <div className="nf-grid" />
        {FLOATING_ITEMS.map((item, i) => (
          <span
            key={i}
            className="nf-particle"
            style={{
              top: item.top,
              left: item.left,
              right: item.right,
              fontSize: item.size,
              animationDelay: item.delay,
            }}
          >
            {item.emoji}
          </span>
        ))}
      </div>

      <main className="nf-content">
        <div className="nf-brand nf-rise">
          <div className="nf-logo-wrap">
            <div className="nf-glow" />
            <img
              src={settings.logo}
              alt={settings.name}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              className={`nf-logo ${settings.logoShape === 'circle' ? 'nf-logo-circle' : ''}`}
            />
          </div>
          <span className="nf-brand-name">{settings.name}</span>
        </div>

        <section className="nf-card nf-rise-delay-1">
          <div className="nf-error-label">ERROR <span>404</span></div>
          <div className="nf-number" aria-label="Error 404">
            <span>4</span><span className="nf-number-zero">0</span><span>4</span>
          </div>
          <div className="nf-divider" />
          <h1>{message.title}</h1>
          <p>{message.description}</p>

          <div className="nf-actions">
            <Link to="/dashboard" className="nf-button nf-button-primary">
              <HomeOutlined />
              Ir al panel principal
            </Link>
            <button onClick={() => navigate(-1)} className="nf-button nf-button-secondary">
              <ArrowLeftOutlined />
              Volver atrás
            </button>
          </div>
        </section>

        <div className="nf-hint nf-rise-delay-2">
          <SearchOutlined />
          <span>{message.hint}</span>
        </div>
      </main>
    </div>
  );
};

export default NotFound;
