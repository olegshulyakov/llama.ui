import daisyuiThemes from 'daisyui/theme/object';
import * as lang from './lang/en.json';
import { Configuration, InferenceProviders } from './utils/types';

export const isDev = import.meta.env.MODE === 'development';

// constants
export const baseUrl = new URL('.', document.baseURI).href
  .toString()
  .replace(/\/$/, '');

export const CONFIG_DEFAULT: Readonly<Configuration> = Object.freeze({
  // Note: in order not to introduce breaking changes, please keep the same data type (number, string, etc) if you want to change the default value. Do not use null or undefined for default value.
  // Do not use nested objects, keep it single level. Prefix the key if you need to group them.
  provider: 'llama-cpp',
  baseUrl: '',
  apiKey: '',
  model: '',
  systemMessage: '',

  /* ui */
  initials: lang.chatMessage.userLabel,
  syntaxHighlightTheme: 'stackoverflow-dark',

  /* conversations */
  pasteLongTextToFileLen: 10000,
  pdfAsImage: false,
  showTokensPerSecond: false,
  showThoughtInProgress: false,
  excludeThoughtOnReq: true,

  /* advanced */
  /* generation */
  overrideGenerationOptions: false,
  temperature: 0.8,
  top_k: 40,
  top_p: 0.95,
  min_p: 0.05,
  max_tokens: -1,

  /* samplers */
  overrideSamplersOptions: false,
  // make sure these default values are in sync with `common.h`
  samplers: 'edkypmxt',
  dynatemp_range: 0.0,
  dynatemp_exponent: 1.0,
  typical_p: 1.0,
  xtc_probability: 0.0,
  xtc_threshold: 0.1,

  /* penalty */
  overridePenaltyOptions: false,
  repeat_last_n: 64,
  repeat_penalty: 1.0,
  presence_penalty: 0.0,
  frequency_penalty: 0.0,
  dry_multiplier: 0.0,
  dry_base: 1.75,
  dry_allowed_length: 2,
  dry_penalty_last_n: -1,

  custom: '', // custom json-stringified object

  /* experimental */
  pyIntepreterEnabled: false,
});

// list of themes supported by daisyui
export const THEMES = Object.freeze(
  ['light', 'dark']
    // make sure light & dark are always at the beginning
    .concat(
      Object.keys(daisyuiThemes).filter((t) => t !== 'light' && t !== 'dark')
    )
);

// list of inference providers
export const INFERENCE_PROVIDERS: Readonly<InferenceProviders> = Object.freeze({
  'llama-cpp': {
    baseUrl: 'http://localhost:8080',
    name: 'Llama.cpp',
    icon: 'assets/providers/llamacpp.svg',
    allowCustomBaseUrl: true,
    isKeyRequired: false,
  },
  'lm-studio': {
    baseUrl: 'http://localhost:1234',
    name: 'LM Studio',
    icon: 'assets/providers/lmstudio.webp',
    allowCustomBaseUrl: true,
    isKeyRequired: false,
  },
  ollama: {
    baseUrl: 'http://localhost:11434',
    name: 'Ollama',
    icon: 'assets/providers/ollama.svg',
    allowCustomBaseUrl: true,
    isKeyRequired: false,
  },
  vllm: {
    baseUrl: 'http://localhost:8000',
    name: 'vLLM',
    icon: 'assets/providers/vllm.svg',
    allowCustomBaseUrl: true,
    isKeyRequired: false,
  },
  openai: {
    baseUrl: 'https://api.openai.com',
    name: 'OpenAI',
    icon: 'assets/providers/openai.svg',
    allowCustomBaseUrl: false,
    isKeyRequired: true,
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    name: 'Anthropic',
    icon: 'assets/providers/anthropic.svg',
    allowCustomBaseUrl: false,
    isKeyRequired: true,
  },
  mistral: {
    baseUrl: 'https://api.mistral.ai',
    name: 'Mistral',
    icon: 'assets/providers/mistral.svg',
    allowCustomBaseUrl: false,
    isKeyRequired: true,
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com',
    name: 'Google',
    icon: 'assets/providers/google.svg',
    allowCustomBaseUrl: false,
    isKeyRequired: true,
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    name: 'DeepSeek',
    icon: 'assets/providers/deepseek.svg',
    allowCustomBaseUrl: false,
    isKeyRequired: true,
  },
  qwen: {
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode',
    name: 'Qwen',
    icon: 'assets/providers/qwen.svg',
    allowCustomBaseUrl: false,
    isKeyRequired: true,
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai',
    name: 'Groq',
    icon: 'assets/providers/groq.svg',
    allowCustomBaseUrl: false,
    isKeyRequired: true,
  },
  'open-router': {
    baseUrl: 'https://openrouter.ai/api',
    name: 'OpenRouter',
    icon: 'assets/providers/openrouter.svg',
    allowCustomBaseUrl: false,
    isKeyRequired: true,
  },
  'hugging-face': {
    baseUrl: 'https://router.huggingface.co',
    name: 'Hugging Face',
    icon: 'assets/providers/huggingface.svg',
    allowCustomBaseUrl: false,
    isKeyRequired: true,
  },
  cohere: {
    baseUrl: 'https://api.cohere.ai',
    name: 'Cohere',
    icon: 'assets/providers/cohere.svg',
    allowCustomBaseUrl: false,
    isKeyRequired: true,
  },
  perplexity: {
    baseUrl: 'https://api.perplexity.ai',
    name: 'Perplexity',
    icon: 'assets/providers/perplexity.svg',
    allowCustomBaseUrl: false,
    isKeyRequired: true,
  },
  together: {
    baseUrl: 'https://api.together.xyz',
    name: 'Together AI',
    icon: 'assets/providers/together.svg',
    allowCustomBaseUrl: false,
    isKeyRequired: true,
  },
  azure: {
    baseUrl: 'https://<your-resource-name>.openai.azure.com',
    name: 'Azure',
    icon: 'assets/providers/microsoft.svg',
    allowCustomBaseUrl: true,
    isKeyRequired: true,
  },
  aws: {
    baseUrl: 'https://<your-resource-name>.amazonaws.com/openai',
    name: 'AWS',
    icon: 'assets/providers/aws.svg',
    allowCustomBaseUrl: true,
    isKeyRequired: true,
  },
  custom: {
    baseUrl: 'https://api.custom.com',
    name: 'OpenAI Compatible',
    icon: '',
    allowCustomBaseUrl: true,
    isKeyRequired: false,
  },
});
