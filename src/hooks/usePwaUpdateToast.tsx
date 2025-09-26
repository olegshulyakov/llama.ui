import { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { ToastPopup } from '../components/ToastPopup';
import { usePWAUpdatePrompt } from './usePWAUpdatePrompt';

const TOAST_IDS = {
  PWA_UPDATE: 'pwa-update',
};

export const usePwaUpdateToast = () => {
  const { t } = useTranslation();
  const { isNewVersion, handleUpdate } = usePWAUpdatePrompt();

  useEffect(() => {
    if (isNewVersion) {
      toast(
        (toast) => (
          <>
            <ToastPopup
              t={toast}
              onSubmit={handleUpdate}
              title={t('toast.newVersion.title')}
              description={t('toast.newVersion.description')}
              note={t('toast.newVersion.note')}
              submitBtn={t('toast.newVersion.submitBtnLabel')}
              cancelBtn={t('toast.newVersion.cancelBtnLabel')}
            />
          </>
        ),
        {
          id: TOAST_IDS.PWA_UPDATE,
          duration: Infinity,
          position: 'top-center',
        }
      );
    }
  }, [t, isNewVersion, handleUpdate]);
};
