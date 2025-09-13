import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePWAUpdatePrompt() {
  const {
    needRefresh: [isNewVersion],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, swRegistration) {
      console.debug('SW Registered:', swUrl, swRegistration);
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  const handleUpdate = async () => {
    await updateServiceWorker(true);
  };

  return { isNewVersion, handleUpdate };
}
