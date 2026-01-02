import { Link } from 'react-router-dom';
import { ArrowLeftOutlined } from '@ant-design/icons';

const NotFound = () => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 text-white px-6 py-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -right-10 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-[-2rem] h-[28rem] w-[28rem] rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_55%)]" />
      </div>

      <main className="relative z-10 mx-auto flex max-w-5xl flex-col items-center text-center">
        <p className="text-xs uppercase tracking-[0.6em] text-slate-300">ERROR 404</p>
        <h1 className="font-headline mt-6 text-4xl font-semibold tracking-tight text-white md:text-6xl">
          Esta página se perdió en el campus
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-300 md:text-xl">
          Tal vez la ruta cambió de salón o necesitas permisos para verla. Puedes volver al panel principal o revisar la sección
          anterior para continuar navegando.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-3 text-base font-semibold text-slate-900 shadow-2xl shadow-blue-500/30 transition hover:-translate-y-0.5 hover:bg-slate-100"
          >
            <ArrowLeftOutlined />
            Ir al panel principal
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/40 bg-white/5 px-7 py-3 text-base font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:border-white/70 hover:bg-white/10"
          >
            Volver al inicio de sesión
          </Link>
        </div>

        <section className="mt-16 grid w-full gap-6 rounded-3xl border border-white/5 bg-white/5 p-6 backdrop-blur-xl md:grid-cols-3">
          <article className="glass-card relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-300">Código</div>
            <div className="font-headline mt-3 text-4xl text-white">404</div>
            <p className="mt-3 text-sm text-slate-300">No encontramos la dirección solicitada.</p>
            <div className="absolute right-4 top-4 h-20 w-20 rounded-full bg-white/10 blur-lg" />
          </article>

          <article className="glass-card rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-300">Acceso</div>
            <div className="font-headline mt-3 text-2xl text-white">Revisa tus permisos</div>
            <p className="mt-3 text-sm text-slate-300">
              Algunas rutas solo están disponibles para roles específicos dentro del sistema.
            </p>
          </article>

          <article className="glass-card rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-300">Atajos</div>
            <ul className="mt-4 space-y-2 text-sm text-slate-200">
              <li className="flex items-center justify-between">
                <span>Volver al dashboard</span>
                <span className="text-white/70">/dashboard</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Panel Master</span>
                <span className="text-white/70">/master</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Control de Estudios</span>
                <span className="text-white/70">/control-estudios</span>
              </li>
            </ul>
          </article>
        </section>
      </main>
    </div>
  );
};

export default NotFound;
