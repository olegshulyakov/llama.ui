import { FC, useCallback, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useParams,
} from 'react-router';
import { Footer } from './components/Footer';
import Header from './components/Header';
import { ModalProvider } from './components/ModalProvider';
import SettingDialog from './components/SettingDialog';
import Sidebar from './components/Sidebar';
import { ToastPopup } from './components/ToastPopup';
import { AppContextProvider, useAppContext } from './context/app';
import { ChatContextProvider } from './context/chat';
import {
  InferenceContextProvider,
  useInferenceContext,
} from './context/inference';
import { useDebouncedCallback } from './hooks/useDebouncedCallback';
import { usePWAUpdatePrompt } from './hooks/usePWAUpdatePrompt';
import * as lang from './lang/en.json';
import ChatScreen from './pages/ChatScreen';
import WelcomeScreen from './pages/WelcomeScreen';

const DEBOUNCE_DELAY = 5000;
const TOAST_IDS = {
  PROVIDER_SETUP: 'provider-setup',
  PWA_UPDATE: 'pwa-update',
};

const App: FC = () => {
  return (
    <ModalProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <div className="flex flex-row drawer xl:drawer-open">
          <AppContextProvider>
            <InferenceContextProvider>
              <ChatContextProvider>
                <Routes>
                  <Route element={<AppLayout />}>
                    <Route path="/chat/:convId" element={<Chat />} />
                    <Route path="*" element={<WelcomeScreen />} />
                  </Route>
                </Routes>
              </ChatContextProvider>
            </InferenceContextProvider>
          </AppContextProvider>
        </div>
      </BrowserRouter>
    </ModalProvider>
  );
};

const AppLayout: FC = () => {
  const { config, showSettings, setShowSettings } = useAppContext();
  const { models } = useInferenceContext();
  const { isNewVersion, handleUpdate } = usePWAUpdatePrompt();

  const checkModelsAndShowToast = useCallback(
    (showSettings: boolean, models: unknown[]) => {
      if (showSettings) return;
      if (Array.isArray(models) && models.length > 0) return;

      toast(
        (t) => {
          const isInitialSetup = config.baseUrl === '';
          const popupConfig = isInitialSetup
            ? lang.welcomePopup
            : lang.noModelsPopup;

          return (
            <ToastPopup
              t={t}
              onSubmit={() => setShowSettings(true)}
              title={popupConfig.title}
              description={popupConfig.description}
              submitBtn={popupConfig.submitBtnLabel}
              cancelBtn={popupConfig.cancelBtnLabel}
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
    [config.baseUrl, setShowSettings]
  );

  const delayedNoModels = useDebouncedCallback(
    checkModelsAndShowToast,
    DEBOUNCE_DELAY
  );

  // Handle PWA updates
  useEffect(() => {
    if (isNewVersion) {
      toast(
        (t) => (
          <ToastPopup
            t={t}
            onSubmit={handleUpdate}
            title={lang.newVersion.title}
            description={lang.newVersion.description}
            note={lang.newVersion.note}
            submitBtn={lang.newVersion.submitBtnLabel}
            cancelBtn={lang.newVersion.cancelBtnLabel}
          />
        ),
        {
          id: TOAST_IDS.PWA_UPDATE,
          duration: Infinity,
          position: 'top-center',
          icon: lang.newVersion.icon,
        }
      );
    }
  }, [isNewVersion, handleUpdate]);

  // Handle model checking
  useEffect(() => {
    delayedNoModels(showSettings, models);
  }, [showSettings, models, delayedNoModels]);

  return (
    <>
      <Sidebar />
      <div className="drawer-content flex flex-col w-full h-screen px-2 bg-base-300">
        <Header />
        <main
          className="grow flex flex-col overflow-auto bg-base-100 rounded-xl"
          id="main-scroll"
        >
          <Outlet />
        </main>
        <Footer />
      </div>
      {showSettings && (
        <SettingDialog
          show={showSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      <Toaster />
    </>
  );
};

const Chat: FC = () => {
  const { convId } = useParams();
  if (!convId) return <Navigate to="/" replace />;
  return <ChatScreen currConvId={convId} />;
};

export default App;
