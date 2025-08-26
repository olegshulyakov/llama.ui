import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  BeakerIcon,
  ChatBubbleLeftEllipsisIcon,
  ChatBubbleLeftRightIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  CircleStackIcon,
  Cog6ToothIcon,
  CogIcon,
  CpuChipIcon,
  EyeIcon,
  FunnelIcon,
  HandRaisedIcon,
  RocketLaunchIcon,
  SquaresPlusIcon,
  TvIcon,
} from '@heroicons/react/24/outline';
import React, { ReactElement, useEffect, useMemo, useState } from 'react';
import { baseUrl, CONFIG_DEFAULT, INFERENCE_PROVIDERS, isDev, SYNTAX_HIGHLIGHT_THEMES } from '../config';
import { useAppContext } from '../context/app.context';
import { useInferenceContext } from '../context/inference.context';
import * as lang from '../lang/en.json';
import { OpenInNewTab } from '../utils/common';
import { InferenceApiModel } from '../utils/inferenceApi';
import { classNames, isBoolean, isNumeric, isString } from '../utils/misc';
import StorageUtils from '../utils/storage';
import {
  Configuration,
  ConfigurationKey,
  InferenceProvidersKey,
  ProviderOption,
} from '../utils/types';
import { useModals } from './ModalProvider';
import { useDebouncedCallback } from './useDebouncedCallback';

// --- Type Definitions ---
enum SettingInputType {
  SHORT_INPUT,
  LONG_INPUT,
  CHECKBOX,
  DROPDOWN,
  CUSTOM,
  SECTION,
}

type SettingFieldInputType = Exclude<
  SettingInputType,
  SettingInputType.CUSTOM | SettingInputType.SECTION
>;

interface SettingFieldInput {
  type: SettingFieldInputType;
  label: string | React.ReactElement;
  note?: string | TrustedHTML;
  key: ConfigurationKey;
  disabled?: boolean;
}

interface SettingFieldCustom {
  type: SettingInputType.CUSTOM;
  key: ConfigurationKey | 'custom' | 'import-export' | 'fetch-models';
  component:
    | string
    | React.FC<{
        value: string | boolean | number;
        onChange: (value: string | boolean) => void;
      }>
    | 'delimeter';
}

interface SettingFieldDropdown {
  type: SettingInputType.DROPDOWN;
  label: string | React.ReactElement;
  note?: string | TrustedHTML;
  key: ConfigurationKey;
  options: { key: string; value: string }[];
}

interface SettingSection {
  type: SettingInputType.SECTION;
  label: string | React.ReactElement;
}

type SettingField =
  | SettingFieldInput
  | SettingFieldCustom
  | SettingSection
  | SettingFieldDropdown;

interface SettingTab {
  title: React.ReactElement;
  fields: SettingField[];
}

// --- Helper Functions ---

const ICON_CLASSNAME = 'w-4 h-4 mr-1 inline';

const toSection = (
  label: string | ReactElement,
  icon?: string | ReactElement
): SettingSection => {
  return {
    type: SettingInputType.SECTION,
    label: (
      <>
        {icon}
        {label}
      </>
    ),
  };
};

const toInput = (
  type: SettingFieldInputType,
  key: ConfigurationKey,
  disabled?: boolean
): SettingFieldInput => {
  return {
    type,
    label: lang.settings.parameters[key].label,
    note: lang.settings.parameters[key].note,
    disabled,
    key,
  };
};
const toDropdown = (
  key: ConfigurationKey,
  options: { key: string; value: string }[]
): SettingFieldDropdown => {
  return {
    type: SettingInputType.DROPDOWN,
    key,
    label: lang.settings.parameters[key].label,
    note: lang.settings.parameters[key].note,
    options,
  };
};

const DELIMETER: SettingFieldCustom = {
  type: SettingInputType.CUSTOM,
  key: 'custom',
  component: 'delimeter',
};

// --- Setting Tabs Configuration ---
const UnusedCustomField: React.FC = () => null;

const getSettingTabsConfiguration = (
  config: Configuration,
  models: InferenceApiModel[]
): SettingTab[] => [
  /* General */
  {
    title: (
      <>
        <Cog6ToothIcon className={ICON_CLASSNAME} />
        General
      </>
    ),
    fields: [
      toSection('Inference Provider'),
      toDropdown(
        'provider',
        Object.entries(INFERENCE_PROVIDERS).map(
          ([key, val]: [string, ProviderOption]) => ({
            key,
            value: val.name,
            icon: val.icon,
          })
        )
      ),
      toInput(
        SettingInputType.SHORT_INPUT,
        'baseUrl',
        !INFERENCE_PROVIDERS[config.provider]?.allowCustomBaseUrl
      ),
      toInput(SettingInputType.SHORT_INPUT, 'apiKey'),
      toDropdown(
        'model',
        models.map((m) => ({
          key: m.id,
          value: m.name,
        }))
      ),
      {
        type: SettingInputType.CUSTOM,
        key: 'fetch-models',
        component: UnusedCustomField,
      },

      DELIMETER,
      DELIMETER,
      toInput(SettingInputType.LONG_INPUT, 'systemMessage'),

      DELIMETER,
      DELIMETER,
      toSection('UI', <TvIcon className={ICON_CLASSNAME} />),
      toInput(SettingInputType.SHORT_INPUT, 'initials'),
      toDropdown(
        'syntaxHighlightTheme',
        SYNTAX_HIGHLIGHT_THEMES.map(theme => ({
          key: theme,
          value: theme,
        }))
      ),
    ],
  },

  /* Conversations */
  {
    title: (
      <>
        <ChatBubbleLeftRightIcon className={ICON_CLASSNAME} />
        Conversations
      </>
    ),
    fields: [
      toSection(
        'Chat',
        <ChatBubbleLeftEllipsisIcon className={ICON_CLASSNAME} />
      ),
      toInput(SettingInputType.SHORT_INPUT, 'pasteLongTextToFileLen'),
      toInput(SettingInputType.CHECKBOX, 'pdfAsImage'),

      /* Performance */
      DELIMETER,
      toSection('Performance', <RocketLaunchIcon className={ICON_CLASSNAME} />),
      toInput(SettingInputType.CHECKBOX, 'showTokensPerSecond'),

      /* Reasoning */
      DELIMETER,
      toSection(
        'Reasoning',
        <ChatBubbleOvalLeftEllipsisIcon className={ICON_CLASSNAME} />
      ),
      toInput(SettingInputType.CHECKBOX, 'showThoughtInProgress'),
      toInput(SettingInputType.CHECKBOX, 'excludeThoughtOnReq'),
    ],
  },

  /* Import/Export */
  {
    title: (
      <>
        <CircleStackIcon className={ICON_CLASSNAME} />
        Import/Export
      </>
    ),
    fields: [
      {
        type: SettingInputType.CUSTOM,
        key: 'import-export',
        component: UnusedCustomField,
      },
    ],
  },

  /* Advanced */
  {
    title: (
      <>
        <SquaresPlusIcon className={ICON_CLASSNAME} />
        Advanced
      </>
    ),
    fields: [
      /* Generation */
      toSection('Generation', <CogIcon className={ICON_CLASSNAME} />),
      toInput(SettingInputType.CHECKBOX, 'overrideGenerationOptions'),
      ...['temperature', 'top_k', 'top_p', 'min_p', 'max_tokens'].map((key) =>
        toInput(
          SettingInputType.SHORT_INPUT,
          key as ConfigurationKey,
          !config['overrideGenerationOptions']
        )
      ),

      /* Samplers */
      DELIMETER,
      toSection('Samplers', <FunnelIcon className={ICON_CLASSNAME} />),
      toInput(SettingInputType.CHECKBOX, 'overrideSamplersOptions'),
      ...[
        'samplers',
        'dynatemp_range',
        'dynatemp_exponent',
        'typical_p',
        'xtc_probability',
        'xtc_threshold',
      ].map((key) =>
        toInput(
          SettingInputType.SHORT_INPUT,
          key as ConfigurationKey,
          !config['overrideSamplersOptions']
        )
      ),

      /* Penalties */
      DELIMETER,
      toSection('Penalties', <HandRaisedIcon className={ICON_CLASSNAME} />),
      toInput(SettingInputType.CHECKBOX, 'overridePenaltyOptions'),
      ...[
        'repeat_last_n',
        'repeat_penalty',
        'presence_penalty',
        'frequency_penalty',
        'dry_multiplier',
        'dry_base',
        'dry_allowed_length',
        'dry_penalty_last_n',
      ].map((key) =>
        toInput(
          SettingInputType.SHORT_INPUT,
          key as ConfigurationKey,
          !config['overridePenaltyOptions']
        )
      ),

      /* Custom */
      DELIMETER,
      toSection('Custom', <CpuChipIcon className={ICON_CLASSNAME} />),
      {
        type: SettingInputType.LONG_INPUT,
        label: (
          <>
            Custom JSON config (For more info, refer to{' '}
            <OpenInNewTab href="https://github.com/ggerganov/llama.cpp/blob/master/tools/server/README.md">
              server documentation
            </OpenInNewTab>
            )
          </>
        ),
        key: 'custom',
      },
    ],
  },

  /* Experimental */
  {
    title: (
      <>
        <BeakerIcon className={ICON_CLASSNAME} />
        Experimental
      </>
    ),
    fields: [
      {
        type: SettingInputType.CUSTOM,
        key: 'custom', // dummy key, won't be used
        component: () => (
          <>
            <p className="mb-8">
              Experimental features are not guaranteed to work correctly.
              <br />
              <br />
              If you encounter any problems, create a{' '}
              <OpenInNewTab href="https://github.com/ggerganov/llama.cpp/issues/new?template=019-bug-misc.yml">
                Bug (misc.)
              </OpenInNewTab>{' '}
              report on Github. Please also specify <b>webui/experimental</b> on
              the report title and include screenshots.
              <br />
              <br />
              Some features may require packages downloaded from CDN, so they
              need internet connection.
            </p>
          </>
        ),
      },
      {
        type: SettingInputType.CHECKBOX,
        label: (
          <>
            <b>Enable Python interpreter</b>
            <br />
            <small className="text-xs">
              This feature uses{' '}
              <OpenInNewTab href="https://pyodide.org">pyodide</OpenInNewTab>,
              downloaded from CDN. To use this feature, ask the LLM to generate
              Python code inside a Markdown code block. You will see a "Run"
              button on the code block, near the "Copy" button.
            </small>
          </>
        ),
        key: 'pyIntepreterEnabled',
      },
    ],
  },
];

export default function SettingDialog({
  show,
  onClose,
}: {
  show: boolean;
  onClose: () => void;
}) {
  const { config, saveConfig } = useAppContext();
  const { models, fetchModels } = useInferenceContext();
  const [tabIdx, setTabIdx] = useState(0);

  // clone the config object to prevent direct mutation
  const [localConfig, setLocalConfig] = useState<Configuration>(
    Object.assign({}, config)
  );
  const [localModels, setLocalModels] = useState<InferenceApiModel[]>(
    Object.assign([], models)
  );
  const settingTabs = useMemo<SettingTab[]>(
    () => getSettingTabsConfiguration(localConfig, localModels),
    [localConfig, localModels]
  );

  const { showConfirm, showAlert } = useModals();

  const resetConfig = async () => {
    if (await showConfirm('Are you sure you want to reset all settings?')) {
      setLocalConfig({ ...CONFIG_DEFAULT } as Configuration);
    }
  };

  const handleSave = async () => {
    // copy the local config to prevent direct mutation
    const newConfig: Configuration = JSON.parse(JSON.stringify(localConfig));
    // validate the config
    for (const key in newConfig) {
      if (!(key in CONFIG_DEFAULT)) continue;

      const typedKey = key as ConfigurationKey;
      const value = newConfig[typedKey];
      const defaultValue = CONFIG_DEFAULT[typedKey];
      if (isString(defaultValue)) {
        if (!isString(value)) {
          await showAlert(`Value for ${key} must be a string`);
          return;
        }
      } else if (isNumeric(defaultValue)) {
        const trimmedValue = String(value).trim();
        const numVal = Number(trimmedValue);
        if (isNaN(numVal) || !isNumeric(numVal) || trimmedValue === '') {
          await showAlert(`Value for ${key} must be numeric`);
          return;
        }
        // force conversion to number
        // @ts-expect-error this is safe
        newConfig[typedKey] = numVal as Configuration[ConfigurationKey];
      } else if (isBoolean(defaultValue)) {
        if (!isBoolean(value)) {
          await showAlert(`Value for ${key} must be boolean`);
          return;
        }
      } else {
        console.error(`Unknown default type for key ${key}`);
      }
    }
    if (isDev) console.debug('Saving config', newConfig);
    saveConfig(newConfig);
    onClose();
  };

  const debouncedFetchModels = useDebouncedCallback(
    (newConfig: Configuration) =>
      fetchModels(newConfig, { silent: true }).then((models) =>
        setLocalModels(models)
      ),
    1000
  );

  const onChange = (key: ConfigurationKey) => (value: string | boolean) => {
    // note: we do not perform validation here, because we may get incomplete value as user is still typing it
    setLocalConfig((prevConfig) => {
      let newConfig = {
        ...prevConfig,
        [key]: value,
      };

      if (key === 'provider') {
        const typedKey = value as InferenceProvidersKey;
        const providerInfo = INFERENCE_PROVIDERS[typedKey];
        if (providerInfo?.baseUrl) {
          newConfig = {
            ...newConfig,
            baseUrl: providerInfo.baseUrl,
          };
        }
      }

      if (['provider', 'baseUrl', 'apiKey'].includes(key)) {
        debouncedFetchModels(newConfig);
      }

      return newConfig;
    });
  };

  return (
    <dialog
      className={classNames({ modal: true, 'modal-open': show })}
      aria-label="Settings dialog"
    >
      <div className="modal-box w-11/12 max-w-4xl">
        <h3 className="text-lg font-bold mb-6">Settings</h3>
        <div className="flex flex-col md:flex-row h-[calc(90vh-12rem)]">
          {/* Left panel, showing sections - Desktop version */}
          <div
            className="hidden md:flex flex-col items-stretch pr-4 mr-4 border-r-2 border-base-200"
            role="complementary"
            aria-description="Settings sections"
            tabIndex={0}
          >
            {settingTabs.map((tab, idx) => (
              <button
                key={idx}
                className={classNames({
                  'btn btn-ghost justify-start font-normal w-44 mb-1': true,
                  'btn-active': tabIdx === idx,
                })}
                onClick={() => setTabIdx(idx)}
                dir="auto"
              >
                {tab.title}
              </button>
            ))}
          </div>

          {/* Left panel, showing sections - Mobile version */}
          {/* This menu is skipped on a11y, otherwise it's repeated the desktop version */}
          <div
            className="md:hidden flex flex-row gap-2 mb-4"
            aria-disabled={true}
          >
            <details className="dropdown">
              <summary className="btn bt-sm w-full m-1">
                {settingTabs[tabIdx].title}
              </summary>
              <ul className="menu dropdown-content bg-base-100 rounded-box z-[1] w-52 p-2 shadow">
                {settingTabs.map((tab, idx) => (
                  <li key={idx}>
                    <button
                      className={classNames({
                        'btn btn-ghost justify-start font-normal': true,
                        'btn-active': tabIdx === idx,
                      })}
                      onClick={() => setTabIdx(idx)}
                      dir="auto"
                    >
                      {tab.title}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          </div>

          {/* Right panel, showing setting fields */}
          <div className="grow overflow-y-auto px-4">
            {settingTabs[tabIdx].fields.map((field, idx) => {
              const key = `${tabIdx}-${idx}`;
              switch (field.type) {
                case SettingInputType.SHORT_INPUT:
                  return (
                    <SettingsModalShortInput
                      key={key}
                      configKey={field.key}
                      field={field}
                      value={localConfig[field.key] as string | number}
                      onChange={onChange(field.key)}
                    />
                  );
                case SettingInputType.LONG_INPUT:
                  return (
                    <SettingsModalLongInput
                      key={key}
                      configKey={field.key}
                      field={field}
                      value={String(localConfig[field.key])}
                      onChange={onChange(field.key)}
                    />
                  );
                case SettingInputType.CHECKBOX:
                  return (
                    <SettingsModalCheckbox
                      key={key}
                      configKey={field.key}
                      field={field}
                      value={!!localConfig[field.key]}
                      onChange={onChange(field.key)}
                    />
                  );
                case SettingInputType.DROPDOWN:
                  return (
                    <SettingsModalDropdown
                      key={key}
                      configKey={field.key}
                      field={field}
                      value={String(localConfig[field.key])}
                      onChange={onChange(field.key)}
                      options={(field as SettingFieldDropdown).options}
                    />
                  );
                case SettingInputType.CUSTOM:
                  switch (field.key) {
                    case 'import-export':
                      return (
                        <ImportExportComponent key={key} onClose={onClose} />
                      );
                    case 'fetch-models':
                      return (
                        <button
                          key={key}
                          className="btn"
                          onClick={() => fetchModels(localConfig)}
                        >
                          <ArrowPathIcon className={ICON_CLASSNAME} />
                          Fetch models
                        </button>
                      );
                    default:
                      if (field.component === 'delimeter') {
                        return <DelimeterComponent key={key} />;
                      }

                      switch (typeof field.component) {
                        case 'string':
                        case 'number':
                        case 'bigint':
                        case 'boolean':
                        case 'symbol':
                          return (
                            <div key={key} className="mb-2">
                              {field.component}
                            </div>
                          );
                        default:
                          return (
                            <div key={key} className="mb-2">
                              {React.createElement(field.component, {
                                value: localConfig[field.key],
                                onChange: (value: string | boolean) =>
                                  onChange(field.key as ConfigurationKey)(
                                    value
                                  ),
                              })}
                            </div>
                          );
                      }
                  }
                case SettingInputType.SECTION:
                  return (
                    <SettingsSectionLabel key={key}>
                      {field.label}
                    </SettingsSectionLabel>
                  );
                default:
                  return null;
              }
            })}

            <p className="opacity-40 mb-6 text-sm mt-8">
              App Version: {import.meta.env.PACKAGE_VERSION}
              <br />
              Settings are saved in browser's localStorage
            </p>
          </div>
        </div>

        <div className="modal-action">
          <button className="btn" onClick={resetConfig}>
            Reset to default
          </button>
          <button className="btn" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-neutral" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </dialog>
  );
}

// --- Helper Input Components ---

interface BaseInputProps {
  configKey: ConfigurationKey | 'custom';
  field: SettingFieldInput;
  onChange: (value: string | boolean) => void;
}

const SettingsModalLongInput: React.FC<BaseInputProps & { value: string }> = ({
  configKey,
  field,
  value,
  onChange,
}) => {
  return (
    <label className="form-control mb-3">
      <div className="label inline text-sm">{field.label || configKey}</div>
      <textarea
        className="textarea textarea-bordered h-24"
        placeholder={`Default: ${CONFIG_DEFAULT[configKey] || 'none'}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={field.disabled}
      />
      {field.note && (
        <div
          className="text-xs opacity-75 max-w-80 mt-1"
          dangerouslySetInnerHTML={{ __html: field.note }}
        />
      )}
    </label>
  );
};

const SettingsModalShortInput: React.FC<
  BaseInputProps & { value: string | number }
> = ({ configKey, field, value, onChange }) => {
  return (
    <label className="form-control flex flex-col justify-center mb-3">
      <div tabIndex={0} role="button" className="font-bold mb-1 md:hidden">
        {field.label || configKey}
      </div>
      <label className="input input-bordered join-item grow flex items-center gap-2 mb-1">
        <div tabIndex={0} role="button" className="font-bold hidden md:block">
          {field.label || configKey}
        </div>
        <input
          type="text"
          className="grow"
          placeholder={`Default: ${CONFIG_DEFAULT[configKey] || 'none'}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={field.disabled}
        />
      </label>
      {field.note && (
        <div className="block opacity-75 max-w-80">
          <div
            className="text-xs"
            dangerouslySetInnerHTML={{ __html: field.note }}
          />
        </div>
      )}
    </label>
  );
};

const SettingsModalCheckbox: React.FC<BaseInputProps & { value: boolean }> = ({
  configKey,
  field,
  value,
  onChange,
}) => {
  return (
    <label className="form-control flex flex-col justify-center mb-3">
      <div className="flex flex-row items-center mb-1">
        <input
          type="checkbox"
          className="toggle"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={field.disabled}
        />
        <span className="ml-2">{field.label || configKey}</span>
      </div>
      {field.note && (
        <div className="block opacity-75 max-w-80">
          <p
            className="text-xs"
            dangerouslySetInnerHTML={{ __html: field.note }}
          />
        </div>
      )}
    </label>
  );
};

const SettingsModalDropdown: React.FC<{
  configKey: ConfigurationKey;
  field: SettingFieldInput;
  onChange: (value: string) => void;
  options: { key: string; value: string; icon?: string }[];
  value: string;
}> = ({ configKey, field, options, value, onChange }) => {
  const disabled = useMemo(() => options.length < 2, [options]);

  useEffect(() => {
    if (options.length === 0 && value !== '') {
      onChange('');
    } else if (options.length === 1 && value !== options[0].value) {
      onChange(options[0].value);
    }
  }, [options, value, onChange]);

  return (
    <label className="form-control flex flex-col justify-center mb-3">
      <div tabIndex={0} role="button" className="font-bold mb-1 md:hidden">
        {field.label || configKey}
      </div>
      <label
        className={classNames({
          'input input-bordered join-item grow flex items-center gap-2 mb-1': true,
          'bg-base-200': disabled,
        })}
      >
        <div tabIndex={0} role="button" className="font-bold hidden md:block">
          {field.label || configKey}
        </div>

        <select
          className="grow"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          {options.map((p) => (
            <option key={p.key} value={p.key}>
              {p.value}
            </option>
          ))}
        </select>
      </label>
      {field.note && (
        <div className="block opacity-75 max-w-80">
          <div
            className="text-xs"
            dangerouslySetInnerHTML={{ __html: field.note }}
          />
        </div>
      )}
    </label>
  );
};

const SettingsSectionLabel: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <div className="pb-2">
    <h4>{children}</h4>
  </div>
);

const DelimeterComponent: React.FC = () => (
  <div className="pb-3" aria-label="delimeter" />
);

const ImportExportComponent: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const onExport = async () => {
    const data = await StorageUtils.exportDB();
    const conversationJson = JSON.stringify(data, null, 2);
    const blob = new Blob([conversationJson], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `database.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = e.target.files;
      if (!files || files.length != 1) return false;
      const data = await files[0].text();
      await StorageUtils.importDB(JSON.parse(data));
      onClose();
    } catch (error) {
      console.error('Failed to import file:', error);
    }
  };

  const debugImportDemoConv = async () => {
    try {
      const res = await fetch(`${baseUrl}/demo-conversation.json`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const demoConv = await res.json();
      StorageUtils.importDB(demoConv);
      onClose();
    } catch (error) {
      console.error('Failed to import demo conversation:', error);
    }
  };

  return (
    <>
      <SettingsSectionLabel>
        <ChatBubbleOvalLeftEllipsisIcon className={ICON_CLASSNAME} />
        Chats
      </SettingsSectionLabel>

      <div className="grid grid-cols-[repeat(2,max-content)] gap-2">
        <button className="btn" onClick={onExport}>
          <ArrowDownTrayIcon className={ICON_CLASSNAME} />
          Export
        </button>

        <input
          id="file-import"
          type="file"
          accept=".json"
          onInput={onImport}
          hidden
        />
        <label
          htmlFor="file-import"
          className="btn"
          aria-label="Import file"
          tabIndex={0}
          role="button"
        >
          <ArrowUpTrayIcon className={ICON_CLASSNAME} />
          Import
        </label>
      </div>

      <DelimeterComponent />

      <SettingsSectionLabel>
        <EyeIcon className={ICON_CLASSNAME} />
        Technical Demo
      </SettingsSectionLabel>

      <button className="btn" onClick={debugImportDemoConv}>
        Import demo conversation
      </button>
    </>
  );
};
