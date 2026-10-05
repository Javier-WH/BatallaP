import { useSyncExternalStore } from 'react';
import {
  canPromptInstall,
  isRunningStandalone,
  promptInstall,
  subscribePwaInstall,
  wasJustInstalled,
} from '@/utils/pwaInstall';

export function usePwaInstall() {
  const canPrompt = useSyncExternalStore(subscribePwaInstall, canPromptInstall);
  const justInstalled = useSyncExternalStore(subscribePwaInstall, wasJustInstalled);
  return {
    canPrompt,
    installed: justInstalled || isRunningStandalone(),
    install: promptInstall,
  };
}
