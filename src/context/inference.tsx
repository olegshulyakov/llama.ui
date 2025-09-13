import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import toast from 'react-hot-toast';
import InferenceApi from '../api/inference';
import { CONFIG_DEFAULT, INFERENCE_PROVIDERS } from '../config';
import {
  Configuration,
  InferenceApiModel,
  LlamaCppServerProps,
} from '../types';
import { deepEqual } from '../utils';
import { useAppContext } from './app';

// --- Type Definitions ---

type FetchOptions = {
  silent?: boolean;
};

interface InferenceContextValue {
  api: InferenceApi;
  models: InferenceApiModel[];
  serverProps: LlamaCppServerProps;

  fetchModels: (
    config: Configuration,
    options?: FetchOptions
  ) => Promise<InferenceApiModel[]>;
}

// --- Constants ---

const noModels: InferenceApiModel[] = [];
const noServerProps: LlamaCppServerProps = {
  build_info: '',
  model: '',
  n_ctx: 0,
  modalities: {
    vision: false,
    audio: false,
  },
};

const InferenceContext = createContext<InferenceContextValue>({
  api: InferenceApi.new(CONFIG_DEFAULT),
  models: noModels,
  serverProps: noServerProps,
  fetchModels: () => new Promise(() => noModels),
});

// --- Helper Functions ---

function isProviderReady(config: Configuration) {
  if (!config.provider) return false;

  const providerInfo = INFERENCE_PROVIDERS[config.provider];
  if (!providerInfo) return true;

  return (
    !!config.baseUrl && (!providerInfo.isKeyRequired || config.apiKey !== '')
  );
}

export const InferenceContextProvider = ({
  children,
}: {
  children: React.ReactElement;
}) => {
  const currentConfigRef = useRef<Configuration>(CONFIG_DEFAULT);
  const [api, setApi] = useState<InferenceApi>(
    InferenceApi.new(CONFIG_DEFAULT)
  );
  const [models, setModels] = useState<InferenceApiModel[]>(noModels);
  const [serverProps, setServerProps] =
    useState<LlamaCppServerProps>(noServerProps);

  // --- Main Functions ---

  const updateApi = useCallback((config: Configuration) => {
    if (Object.is(CONFIG_DEFAULT, config)) return;
    console.debug('Update Inference API');
    const newApi = InferenceApi.new(config);
    setApi(newApi);
  }, []);

  const syncServer = useCallback(
    async (config: Configuration, options: FetchOptions = {}) => {
      if (Object.is(CONFIG_DEFAULT, config) || !config.baseUrl) return;
      console.debug('Synchronize models & props with server');
      setModels(await fetchModels(config, options));
      setServerProps(await fetchServerProperties(config, options));
    },
    []
  );

  const fetchModels = async (
    config: Configuration,
    options: FetchOptions = { silent: false }
  ): Promise<InferenceApiModel[]> => {
    if (!isProviderReady(config)) {
      return noModels;
    }

    console.debug('Fetch models');
    const newApi = InferenceApi.new(config);
    let newModels = noModels;
    try {
      newModels = await newApi.v1Models();
    } catch (err) {
      if (!options.silent) {
        console.error('fetch models failed: ', err);
        toast.error(`Inference Provider: ${(err as Error).message}.`);
      }
    }
    return newModels;
  };

  const fetchServerProperties = async (
    config: Configuration,
    options: FetchOptions = { silent: false }
  ): Promise<LlamaCppServerProps> => {
    if (config.provider !== 'llama-cpp' || !isProviderReady(config)) {
      return noServerProps;
    }

    console.debug('Fetch server properties');
    const newApi = InferenceApi.new(config);
    let newProps = noServerProps;
    try {
      newProps = await newApi.getServerProps();
    } catch (err) {
      if (!options.silent) {
        console.error('fetch llama.cpp props failed: ', err);
      }
    }
    return newProps;
  };

  // --- Initialization ---

  const { config } = useAppContext();
  useEffect(() => {
    const prevConfig = currentConfigRef.current;
    if (!deepEqual(currentConfigRef.current, config)) {
      updateApi(config);
    }
    if (
      prevConfig.baseUrl !== config.baseUrl ||
      prevConfig.apiKey !== config.apiKey
    ) {
      syncServer(config);
    }
    currentConfigRef.current = config;
  }, [syncServer, updateApi, config]);

  return (
    <InferenceContext.Provider
      value={{ api, models, serverProps, fetchModels }}
    >
      {children}
    </InferenceContext.Provider>
  );
};

export const useInferenceContext = () => {
  const context = useContext(InferenceContext);
  if (!context) {
    throw new Error(
      'useInferenceContext must be used within an InferenceContextProvider'
    );
  }
  return context;
};
