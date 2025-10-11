import { FC } from 'react';
import { Toaster } from 'react-hot-toast';
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
import Sidebar from './components/Sidebar';
import { useProviderSetup } from './hooks/useProviderSetup';
import { usePWAUpdateToast } from './hooks/usePWAUpdatePrompt';
import ChatPage from './pages/Chat';
import SettingsPage from './pages/Settings';
import WelcomePage from './pages/Welcome';
import { AppContextProvider } from './store/app';
import { ChatContextProvider } from './store/chat';
import { InferenceContextProvider } from './store/inference';
import { ModalProvider } from './store/modal';

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
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<WelcomePage />} />
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
  usePWAUpdateToast();
  useProviderSetup();

  return (
    <>
      <Sidebar />
      <div className="drawer-content flex flex-col w-full h-screen px-1 md:px-2 bg-base-300">
        <Header />
        <main
          className="grow flex flex-col overflow-auto bg-base-100 rounded-xl"
          id="main-scroll"
        >
          <Outlet />
        </main>
        <Footer />
      </div>
      <Toaster />
    </>
  );
};

const Chat: FC = () => {
  const { convId } = useParams();
  if (!convId) return <Navigate to="/" replace />;
  return <ChatPage currConvId={convId} />;
};

export default App;
