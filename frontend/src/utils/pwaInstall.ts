// Captures the browser's install prompt as early as possible: `beforeinstallprompt` fires
// once, usually before React mounts, so the listener lives at module level (imported from
// the app entry points) and components subscribe to it.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

export function subscribePwaInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const canPromptInstall = (): boolean => deferredPrompt !== null;
export const wasJustInstalled = (): boolean => installed;

// True when the page is already running as an installed app.
export function isRunningStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  const event = deferredPrompt;
  deferredPrompt = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}

// Resolves true if the browser confirms the install (appinstalled) within `ms`.
export function waitForInstalled(ms: number): Promise<boolean> {
  if (installed) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => { unsubscribe(); resolve(false); }, ms);
    const unsubscribe = subscribePwaInstall(() => {
      if (!installed) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(true);
    });
  });
}

// On Android only Chrome-family browsers (Chrome, Edge, Samsung Internet) mint a real
// installed app (WebAPK); the others usually just add a home-screen shortcut.
export async function describeBrowser(): Promise<{ name: string; installsRealApp: boolean }> {
  const ua = navigator.userAgent;
  const brave = await (navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } }).brave?.isBrave?.().catch(() => false);
  if (brave) return { name: 'Brave', installsRealApp: false };
  if (/OPR\/|Opera/i.test(ua)) return { name: 'Opera', installsRealApp: false };
  if (/Vivaldi/i.test(ua)) return { name: 'Vivaldi', installsRealApp: false };
  if (/Firefox/i.test(ua)) return { name: 'Firefox', installsRealApp: false };
  if (/SamsungBrowser/i.test(ua)) return { name: 'Samsung Internet', installsRealApp: true };
  if (/EdgA|Edg\//i.test(ua)) return { name: 'Edge', installsRealApp: true };
  return { name: 'Chrome u otro basado en Chromium', installsRealApp: /Chrome\//.test(ua) };
}

export interface PwaCheck {
  label: string;
  ok: boolean;
  detail: string;
}

// Explains why the browser may not be offering the install option.
export async function collectPwaDiagnostics(): Promise<PwaCheck[]> {
  const checks: PwaCheck[] = [];

  const browser = await describeBrowser();
  checks.push({
    label: `Navegador: ${browser.name}`,
    ok: browser.installsRealApp,
    detail: browser.installsRealApp
      ? 'Instala una aplicación real (aparece en el cajón de aplicaciones).'
      : 'En Android este navegador suele crear solo un acceso directo en la pantalla de inicio, no una app. Para una instalación completa usa Chrome.',
  });

  checks.push({
    label: 'Conexión segura (HTTPS con certificado válido)',
    ok: window.isSecureContext,
    detail: window.isSecureContext
      ? window.location.origin
      : 'La página no se considera contexto seguro. Con certificado autofirmado o inválido el navegador no registra el service worker ni ofrece instalar.',
  });

  const hasSw = 'serviceWorker' in navigator;
  checks.push({
    label: 'El navegador soporta service workers',
    ok: hasSw,
    detail: hasSw ? 'Sí' : 'No disponible (requiere HTTPS válido).',
  });

  if (hasSw) {
    let registration: ServiceWorkerRegistration | undefined;
    try { registration = await navigator.serviceWorker.getRegistration(); } catch { /* ignore */ }
    const state = registration?.active?.state;
    checks.push({
      label: 'Service worker registrado y activo',
      ok: state === 'activated',
      detail: registration
        ? `Estado: ${state ?? (registration.installing ? 'instalando' : registration.waiting ? 'en espera' : 'desconocido')}`
        : 'No hay service worker registrado. Recarga la página; si persiste, revisa que /sw.js cargue sin error.',
    });
  }

  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  checks.push({
    label: 'La página enlaza un manifest',
    ok: !!link,
    detail: link ? link.href : 'Falta <link rel="manifest">.',
  });

  if (link) {
    try {
      const res = await fetch(link.href, { cache: 'no-store' });
      const type = res.headers.get('content-type') || '';
      const manifest = await res.json();
      const icons: { sizes?: string }[] = Array.isArray(manifest.icons) ? manifest.icons : [];
      const hasSize = (n: number) => icons.some((i) => (i.sizes || '').split(/\s+/).includes(`${n}x${n}`));
      checks.push({
        label: 'El manifest se descarga y es válido',
        ok: res.ok && !!manifest.name && !!manifest.start_url && manifest.display === 'standalone',
        detail: `HTTP ${res.status} · ${type || 'sin content-type'} · ${manifest.name ?? 'sin name'} · display=${manifest.display ?? 'n/d'}`,
      });
      const manifestUrl = new URL(link.href);
      const scopeUrl = new URL(manifest.scope ?? '.', manifestUrl);
      const startUrl = new URL(manifest.start_url ?? '.', manifestUrl);
      const inScope = (u: URL) => u.origin === scopeUrl.origin && u.pathname.startsWith(scopeUrl.pathname);
      checks.push({
        label: 'La página y el inicio de la app están dentro del scope',
        ok: inScope(new URL(window.location.href)) && inScope(startUrl),
        detail: `scope=${scopeUrl.pathname} · start_url=${startUrl.pathname} · id=${manifest.id ?? 'n/d'} · página=${window.location.pathname}`,
      });
      checks.push({
        label: 'Iconos de 192 y 512 px',
        ok: hasSize(192) && hasSize(512),
        detail: icons.map((i) => i.sizes).join(', ') || 'Sin iconos',
      });
    } catch {
      checks.push({
        label: 'El manifest se descarga y es válido',
        ok: false,
        detail: 'No se pudo descargar o interpretar el manifest (¿lo bloquea el proxy o devuelve HTML?).',
      });
    }
  }

  checks.push({
    label: 'El navegador ofreció instalar (beforeinstallprompt)',
    ok: canPromptInstall(),
    detail: canPromptInstall()
      ? 'Sí: el botón "Instalar app" abrirá el diálogo del sistema.'
      : 'Todavía no. Algunos navegadores (p. ej. Vivaldi, Opera) no lo emiten; usa el menú del navegador.',
  });

  return checks;
}
