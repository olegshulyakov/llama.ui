import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { CONFIG_DEFAULT, SYNTAX_THEMES } from '../config';
import IndexedDB from '../database/indexedDB';
import LocalStorage from '../database/localStorage';
import {
  Configuration,
  ConfigurationPreset,
  ExportJsonStructure,
} from '../types';

// Define action type enum
enum AppActionType {
  SET_CONFIG = 'SET_CONFIG',
  SET_PRESETS = 'SET_PRESETS',
  SET_SHOW_SETTINGS = 'SET_SHOW_SETTINGS',
  SET_CURRENT_THEME = 'SET_CURRENT_THEME',
  SET_CURRENT_SYNTAX_THEME = 'SET_CURRENT_SYNTAX_THEME',
}

// Define action types using the enum
type AppAction =
  | { type: AppActionType.SET_CONFIG; payload: Configuration }
  | { type: AppActionType.SET_PRESETS; payload: ConfigurationPreset[] }
  | { type: AppActionType.SET_SHOW_SETTINGS; payload: boolean }
  | { type: AppActionType.SET_CURRENT_THEME; payload: string }
  | { type: AppActionType.SET_CURRENT_SYNTAX_THEME; payload: string };

// Define initial state
interface AppState {
  config: Configuration;
  presets: ConfigurationPreset[];
  showSettings: boolean;
  currentTheme: string;
  currentSyntaxTheme: string;
}

const initialState: AppState = {
  config: CONFIG_DEFAULT,
  presets: [],
  showSettings: false,
  currentTheme: LocalStorage.getTheme(),
  currentSyntaxTheme: LocalStorage.getSyntaxTheme(),
};

// Reducer function
const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case AppActionType.SET_CONFIG:
      return { ...state, config: action.payload };
    case AppActionType.SET_PRESETS:
      return { ...state, presets: action.payload };
    case AppActionType.SET_SHOW_SETTINGS:
      return { ...state, showSettings: action.payload };
    case AppActionType.SET_CURRENT_THEME:
      return { ...state, currentTheme: action.payload };
    case AppActionType.SET_CURRENT_SYNTAX_THEME:
      return { ...state, currentSyntaxTheme: action.payload };
    default:
      return state;
  }
};

interface AppContextValue {
  config: Configuration;
  saveConfig: (config: Configuration) => void;
  presets: ConfigurationPreset[];
  savePreset: (name: string, config: Configuration) => Promise<void>;
  removePreset: (name: string) => Promise<void>;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  currentTheme: string;
  switchTheme: (theme: string) => void;
  currentSyntaxTheme: string;
  switchSyntaxTheme: (theme: string) => void;
  importDB: (data: string) => Promise<void>;
  exportDB(convId?: string): Promise<ExportJsonStructure>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppContextProvider = ({
  children,
}: {
  children: React.ReactElement;
}) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { t } = useTranslation();

  // --- Main Functions ---

  const init = useCallback(async (): Promise<boolean> => {
    console.debug('Load config & presets');
    const config = LocalStorage.getConfig();
    dispatch({ type: AppActionType.SET_CONFIG, payload: config });

    const presets = await IndexedDB.getPresets();
    dispatch({ type: AppActionType.SET_PRESETS, payload: presets });
    return !!config;
  }, []);

  const saveConfig = useCallback((config: Configuration) => {
    console.debug('Save config', config);
    LocalStorage.setConfig(config);
    dispatch({ type: AppActionType.SET_CONFIG, payload: config });
  }, []);

  const savePreset = useCallback(
    async (name: string, config: Configuration) => {
      console.debug('Save preset', { name, config });
      await IndexedDB.savePreset(name, config);
      const presets = await IndexedDB.getPresets();
      dispatch({ type: AppActionType.SET_PRESETS, payload: presets });
      toast.success(t('state.preset.saved'));
    },
    [t]
  );

  const removePreset = useCallback(
    async (name: string) => {
      console.debug('Remove preset', name);
      await IndexedDB.removePreset(name);
      const presets = await IndexedDB.getPresets();
      dispatch({ type: AppActionType.SET_PRESETS, payload: presets });
      toast.success(t('state.preset.removed'));
    },
    [t]
  );

  const setShowSettings = useCallback(
    (show: boolean) =>
      dispatch({ type: AppActionType.SET_SHOW_SETTINGS, payload: show }),
    []
  );

  // --- Import/Export ---

  const importDB = useCallback(
    async (data: string) => {
      try {
        await IndexedDB.importDB(JSON.parse(data));

        const presets = await IndexedDB.getPresets();
        dispatch({ type: AppActionType.SET_PRESETS, payload: presets });
      } catch (error) {
        console.error('Error during database import:', error);
        toast.error(t('state.database.import.failed'));
        throw error; // Re-throw to allow caller to handle
      }
      console.info('Database import completed successfully.');
      toast.success(t('state.database.import.completed'));
    },
    [t]
  );

  const exportDB = useCallback(
    async (convId?: string): Promise<ExportJsonStructure> => {
      let data: ExportJsonStructure;
      try {
        data = await IndexedDB.exportDB(convId);
      } catch (error) {
        console.error('Error during database export:', error);
        toast.error(t('state.database.export.failed'));
        throw error; // Re-throw to allow caller to handle
      }
      console.info('Database export completed successfully.');
      toast.success(t('state.database.export.completed'));

      return data;
    },
    [t]
  );

  // --- DaisyUI Theme ---

  const switchTheme = useCallback((theme: string) => {
    console.debug('Switch theme', theme);
    LocalStorage.setTheme(theme);
    dispatch({ type: AppActionType.SET_CURRENT_THEME, payload: theme });

    // Update body color scheme
    document.body.setAttribute('data-theme', theme);

    // Update <meta name="theme-color" />
    if (document.getElementsByClassName('bg-base-300').length > 0) {
      const color = window
        .getComputedStyle(document.getElementsByClassName('bg-base-300')[0])
        .getPropertyValue('background-color');
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', color);
    }
  }, []);

  // --- Highlight.js Theme ---

  const switchSyntaxTheme = useCallback((theme: string) => {
    console.debug('Switch syntax theme', theme);
    LocalStorage.setSyntaxTheme(theme);
    dispatch({ type: AppActionType.SET_CURRENT_SYNTAX_THEME, payload: theme });

    // Update body color scheme
    document.body.setAttribute(
      'data-hljs-theme',
      SYNTAX_THEMES.includes(theme) ? theme : 'auto'
    );
  }, []);

  // --- Initialization ---

  useEffect(() => {
    init();
    switchTheme(LocalStorage.getTheme());
    switchSyntaxTheme(LocalStorage.getSyntaxTheme());
  }, [init, switchSyntaxTheme, switchTheme]);

  return (
    <AppContext.Provider
      value={{
        ...state,
        saveConfig,
        savePreset,
        removePreset,
        setShowSettings,
        switchTheme,
        switchSyntaxTheme,
        importDB,
        exportDB,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};
