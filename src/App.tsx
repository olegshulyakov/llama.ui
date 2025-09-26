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
import { AppContextProvider } from './context/app';
import { ChatContextProvider } from './context/chat';
import { InferenceContextProvider } from './context/inference';
import { ModalProvider } from './context/modal';
import { usePwaUpdateToast } from './hooks/usePwaUpdateToast';
import { useProviderSetupToast } from './hooks/useProviderSetupToast';
import ChatScreen from './pages/ChatScreen';
import Settings from './pages/Settings';
import WelcomeScreen from './pages/WelcomeScreen';

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
                    <Route path="/settings" element={<Settings />} />
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
  usePwaUpdateToast();
  useProviderSetupToast();

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
  return <ChatScreen currConvId={convId} />;
};

export default App;
