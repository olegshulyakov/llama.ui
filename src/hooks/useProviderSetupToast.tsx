import { useCallback, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ToastPopup } from '../components/ToastPopup';
import { useAppContext } from '../context/app';
import { useInferenceContext } from '../context/inference';
import { useDebouncedCallback } from './useDebouncedCallback';

const DEBOUNCE_DELAY = 5000;
const TOAST_IDS = {
  PROVIDER_SETUP: 'provider-setup',
};

export const useProviderSetupToast = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { config, showSettings } = useAppContext();
  const { models } = useInferenceContext();

  const checkModelsAndShowToast = useCallback(
    (showSettings: boolean, models: unknown[]) => {
      if (showSettings) return;
      if (Array.isArray(models) && models.length > 0) return;

      const isInitialSetup = config.baseUrl === '';
      const popupConfig = isInitialSetup ? 'welcomePopup' : 'noModelsPopup';
      toast(
        (toast) => {
          return (
            <ToastPopup
              t={toast}
              onSubmit={() => navigate('/settings')}
              title={t(`toast.${popupConfig}.title`)}
              description={t(`toast.${popupConfig}.description`)}
              note={t(`toast.${popupConfig}.note`)}
              submitBtn={t(`toast.${popupConfig}.submitBtnLabel`)}
              cancelBtn={t(`toast.${popupConfig}.cancelBtnLabel`)}
            />
          );
        },
        {
          id: TOAST_IDS.PROVIDER_SETUP,
          duration: config.baseUrl === '' ? Infinity : 10000,
          position: 'top-center',
        }
      );
    },
    [t, config.baseUrl, navigate]
  );

  const delayedNoModels = useDebouncedCallback(
    checkModelsAndShowToast,
    DEBOUNCE_DELAY
  );

  useEffect(() => {
    delayedNoModels(showSettings, models);
  }, [showSettings, models, delayedNoModels]);
};
