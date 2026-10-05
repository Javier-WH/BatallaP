import React, { useState } from 'react';
import { Button, Modal, Spin, message } from 'antd';
import { CheckCircleFilled, CloseCircleFilled, DownloadOutlined } from '@ant-design/icons';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { collectPwaDiagnostics, type PwaCheck } from '@/utils/pwaInstall';

/**
 * "Instalar app" button. Uses the browser's install prompt when it offered one; otherwise
 * explains how to install from the browser menu and shows what is missing for the browser
 * to consider the page installable. Hidden once the app is installed / running standalone.
 */
const InstallAppButton: React.FC = () => {
  const { canPrompt, installed, install } = usePwaInstall();
  const [helpOpen, setHelpOpen] = useState(false);
  const [checks, setChecks] = useState<PwaCheck[] | null>(null);

  if (installed) return null;

  const openHelp = async () => {
    setHelpOpen(true);
    setChecks(null);
    setChecks(await collectPwaDiagnostics());
  };

  const handleClick = async () => {
    if (!canPrompt) { openHelp(); return; }
    const outcome = await install();
    if (outcome === 'accepted') message.success('Instalando la aplicación…');
  };

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <>
      <Button icon={<DownloadOutlined />} size="small" onClick={handleClick}>
        Instalar app
      </Button>

      <Modal
        title="Instalar la aplicación"
        open={helpOpen}
        onCancel={() => setHelpOpen(false)}
        footer={<Button onClick={() => setHelpOpen(false)}>Cerrar</Button>}
      >
        <div className="text-sm text-slate-600 space-y-3">
          <p className="m-0">
            {isIos
              ? 'En iPhone/iPad: toca el botón Compartir y elige "Añadir a pantalla de inicio".'
              : 'Abre el menú del navegador (⋮ o ☰) y elige "Instalar app" o "Agregar a pantalla de inicio".'}
          </p>
          <p className="m-0 text-xs text-slate-400">
            Si esa opción no aparece, el navegador no considera la página instalable. Estas comprobaciones indican qué falta:
          </p>
          {!checks ? (
            <div className="flex justify-center py-4"><Spin /></div>
          ) : (
            <ul className="list-none p-0 m-0 space-y-2">
              {checks.map((check) => (
                <li key={check.label} className="flex gap-2 items-start">
                  {check.ok
                    ? <CheckCircleFilled style={{ color: '#16a34a', marginTop: 3 }} />
                    : <CloseCircleFilled style={{ color: '#dc2626', marginTop: 3 }} />}
                  <div>
                    <div className="font-medium text-slate-700">{check.label}</div>
                    <div className="text-xs text-slate-400 break-all">{check.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </>
  );
};

export default InstallAppButton;
