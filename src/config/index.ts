import daisyuiThemes from 'daisyui/theme/object';
import { Configuration, InferenceProviders } from '../types';
import baseUrl from './baseUrl';
import defaultConfig from './config-default.json';
import highlightThemes from './highlight.js-themes.json';
import inferenceProviders from './inference-providers.json';

/**
 * Development environment flag
 * @constant
 * @type {boolean}
 * @description Indicates whether the application is running in development mode
 */
export const isDev: boolean = import.meta.env.MODE === 'development';

/**
 * Default configuration object
 * @constant
 * @type {Readonly<Configuration>}
 * @description Immutable default configuration loaded from config-default.json
 * @see Configuration
 */
export const CONFIG_DEFAULT: Readonly<Configuration> =
  Object.freeze(defaultConfig);

/**
 * List of available UI themes supported by DaisyUI
 * @constant
 * @type {readonly string[]}
 * @description Array of theme names with 'light' and 'dark' always at the beginning,
 * followed by all other DaisyUI themes excluding light/dark
 */
export const THEMES: readonly string[] = Object.freeze(
  ['light', 'dark']
    // make sure light & dark are always at the beginning
    .concat(
      Object.keys(daisyuiThemes).filter((t) => t !== 'light' && t !== 'dark')
    )
);

/**
 * List of syntax highlighting themes supported by Highlight.js
 * @constant
 * @type {readonly string[]}
 * @description Array of theme names available for code syntax highlighting
 */
export const SYNTAX_THEMES: readonly string[] = Object.freeze(highlightThemes);

/**
 * List of available inference providers
 * @constant
 * @type {Readonly<InferenceProviders>}
 * @description Immutable collection of inference providers loaded from inference-providers.json
 * @see InferenceProviders
 */
export const INFERENCE_PROVIDERS: Readonly<InferenceProviders> =
  Object.freeze(inferenceProviders);

/**
 * Base URL for the application
 * @constant
 * @type {string}
 * @description The base URL path used for routing and API calls
 */
export { baseUrl };
