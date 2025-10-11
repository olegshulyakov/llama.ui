import { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { ToastPopup } from '../components/ToastPopup';
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

export function usePWAUpdateToast() {
  const { t } = useTranslation();
  const { isNewVersion, handleUpdate } = usePWAUpdatePrompt();

  useEffect(() => {
    if (!isNewVersion) return;

    toast(
      (toast) => (
        <ToastPopup
          toastId={toast.id}
          onSubmit={handleUpdate}
          title={t('toast.newVersion.title')}
          description={t('toast.newVersion.description')}
          note={t('toast.newVersion.note')}
          submitBtn={t('toast.newVersion.submitBtnLabel')}
          cancelBtn={t('toast.newVersion.cancelBtnLabel')}
        />
      ),
      {
        id: 'pwa-update',
        duration: Infinity,
        position: 'top-center',
      }
    );
  }, [t, isNewVersion, handleUpdate]);
}
