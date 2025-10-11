import { useCallback, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ToastPopup } from '../components/ToastPopup';
import { useAppContext } from '../store/app';
import { useInferenceContext } from '../store/inference';
import { useDebouncedCallback } from './useDebouncedCallback';

const DEBOUNCE_DELAY = 5000;

export function useProviderSetup() {
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
        (toast) => (
          <ToastPopup
            toastId={toast.id}
            onSubmit={() => navigate('/settings')}
            title={t(`toast.${popupConfig}.title`)}
            description={t(`toast.${popupConfig}.description`)}
            note={t(`toast.${popupConfig}.note`)}
            submitBtn={t(`toast.${popupConfig}.submitBtnLabel`)}
            cancelBtn={t(`toast.${popupConfig}.cancelBtnLabel`)}
          />
        ),
        {
          id: 'provider-setup',
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
}
