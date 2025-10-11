import React, {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useRef,
} from 'react';
import { Trans } from 'react-i18next';
import { Button } from '../components';

enum ModalActionType {
  SHOW_MODAL = 'SHOW_MODAL',
  HIDE_MODAL = 'HIDE_MODAL',
}

type ModalType = 'confirm' | 'prompt' | 'alert';

type ModalAction =
  | {
      type: ModalActionType.SHOW_MODAL;
      modalType: ModalType;
      message: string;
      defaultValue?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolve: (value: any) => void;
    }
  | {
      type: ModalActionType.HIDE_MODAL;
      modalType: ModalType;
    };

interface ModalState {
  [key: string]: {
    isOpen: boolean;
    message: string;
    defaultValue?: string;
    resolve: ((value?: boolean | string) => void) | null;
  };
}

const initialState: ModalState = {
  confirm: {
    isOpen: false,
    message: '',
    resolve: null,
  },
  prompt: {
    isOpen: false,
    message: '',
    defaultValue: undefined,
    resolve: null,
  },
  alert: {
    isOpen: false,
    message: '',
    resolve: null,
  },
};

function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case ModalActionType.SHOW_MODAL:
      return {
        ...state,
        [action.modalType]: {
          isOpen: true,
          message: action.message,
          defaultValue: action.defaultValue,
          resolve: action.resolve,
        },
      };
    case ModalActionType.HIDE_MODAL:
      return {
        ...state,
        [action.modalType]: {
          ...state[action.modalType],
          isOpen: false,
          message: '',
          defaultValue: undefined,
          resolve: null,
        },
      };
    default:
      return state;
  }
}

type ModalContextType = {
  showConfirm: (message: string) => Promise<boolean>;
  showPrompt: (
    message: string,
    defaultValue?: string
  ) => Promise<string | undefined>;
  showAlert: (message: string) => Promise<void>;
};

const ModalContext = createContext<ModalContextType>(null!);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(modalReducer, initialState);
  const inputRef = useRef<HTMLInputElement>(null);

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      dispatch({
        type: ModalActionType.SHOW_MODAL,
        modalType: 'confirm',
        message,
        resolve,
      });
    });
  }, []);

  const showPrompt = useCallback(
    (message: string, defaultValue?: string): Promise<string | undefined> => {
      return new Promise((resolve) => {
        dispatch({
          type: ModalActionType.SHOW_MODAL,
          modalType: 'prompt',
          message,
          defaultValue,
          resolve,
        });
      });
    },
    []
  );

  const showAlert = useCallback((message: string): Promise<void> => {
    return new Promise((resolve) => {
      dispatch({
        type: ModalActionType.SHOW_MODAL,
        modalType: 'alert',
        message,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(
    (result: boolean) => {
      state.confirm.resolve?.(result);
      dispatch({ type: ModalActionType.HIDE_MODAL, modalType: 'confirm' });
    },
    [state]
  );

  const handlePrompt = useCallback(
    (result?: string) => {
      state.prompt.resolve?.(result);
      dispatch({ type: ModalActionType.HIDE_MODAL, modalType: 'prompt' });
    },
    [state]
  );

  const handleAlertClose = useCallback(() => {
    state.alert.resolve?.();
    dispatch({ type: ModalActionType.HIDE_MODAL, modalType: 'alert' });
  }, [state]);

  return (
    <ModalContext.Provider value={{ showConfirm, showPrompt, showAlert }}>
      {children}

      {/* Confirm Modal */}
      {state.confirm.isOpen && (
        <dialog className="modal modal-open z-[1100]">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{state.confirm.message}</h3>
            <div className="modal-action">
              <Button variant="ghost" onClick={() => handleConfirm(false)}>
                <Trans i18nKey="modals.cancelBtnLabel" />
              </Button>
              <Button variant="error" onClick={() => handleConfirm(true)}>
                <Trans i18nKey="modals.confirmBtnLabel" />
              </Button>
            </div>
          </div>
        </dialog>
      )}

      {/* Prompt Modal */}
      {state.prompt.isOpen && (
        <dialog className="modal modal-open z-[1100]">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{state.prompt.message}</h3>
            <input
              type="text"
              className="input input-bordered w-full mt-2"
              defaultValue={state.prompt.defaultValue}
              ref={inputRef}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handlePrompt((e.target as HTMLInputElement).value);
                }
              }}
            />
            <div className="modal-action">
              <Button variant="ghost" onClick={() => handlePrompt()}>
                <Trans i18nKey="modals.cancelBtnLabel" />
              </Button>
              <Button
                variant="neutral"
                onClick={() => handlePrompt(inputRef.current?.value)}
              >
                <Trans i18nKey="modals.submitBtnLabel" />
              </Button>
            </div>
          </div>
        </dialog>
      )}

      {/* Alert Modal */}
      {state.alert.isOpen && (
        <dialog className="modal modal-open z-[1100]">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{state.alert.message}</h3>
            <div className="modal-action">
              <Button onClick={handleAlertClose}>
                <Trans i18nKey="modals.okBtnLabel" />
              </Button>
            </div>
          </div>
        </dialog>
      )}
    </ModalContext.Provider>
  );
}

export function useModals() {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useModals must be used within ModalProvider');
  return context;
}
