import {
  ArrowDownTrayIcon,
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
} from '@heroicons/react/24/outline';
import React, { useMemo, useState } from 'react';
import { CONFIG_DEFAULT, isDev } from '../config';
import * as messages from '../lang/en.json';
import { useAppContext } from '../utils/app.context';
import { OpenInNewTab } from '../utils/common';
import { classNames, isBoolean, isNumeric, isString } from '../utils/misc';
import StorageUtils from '../utils/storage';
import { Configuration } from '../utils/types';
import { useModals } from './ModalProvider';

// --- Type Definitions ---

type ConfigurationKey = keyof Configuration;

enum SettingInputType {
  SHORT_INPUT,
  LONG_INPUT,
  CHECKBOX,
  CUSTOM,
  SECTION,
  DELIMETER,
}

type SettingFieldInputType = Exclude<
  SettingInputType,
  | SettingInputType.CUSTOM
  | SettingInputType.SECTION
  | SettingInputType.DELIMETER
>;

interface SettingFieldInput {
  type: SettingFieldInputType;
  label: string | React.ReactElement;
  note?: string | React.ReactElement;
  key: ConfigurationKey;
  disabled?: boolean;
}

interface SettingFieldCustom {
  type: SettingInputType.CUSTOM;
  key: ConfigurationKey | 'custom';
  component:
    | string
    | React.FC<{
        value: string | boolean | number;
        onChange: (value: string | boolean) => void;
      }>;
}

interface SettingSection {
  type: SettingInputType.SECTION;
  label: string | React.ReactElement;
}

interface SettingDelimeter {
  type: SettingInputType.DELIMETER;
}

type SettingField =
  | SettingFieldInput
  | SettingFieldCustom
  | SettingSection
  | SettingDelimeter;

interface SettingTab {
  title: React.ReactElement;
  fields: SettingField[];
}

// --- Helper Functions ---

const ICON_CLASSNAME = 'w-4 h-4 mr-1 inline';
const TITLE_ICON_CLASSNAME = 'w-4 h-4 mr-1 inline';

const toInput = (
  type: SettingFieldInputType,
  key: ConfigurationKey,
  disabled?: boolean
): SettingFieldInput => {
  return {
    type,
    ...(messages.settings.parameters[key] as Omit<
      Omit<SettingFieldInput, 'type'>,
      'key'
    >),
    disabled,
    key,
  };
};

// --- Setting Tabs Configuration ---

const getSettingTabsConfiguration = (
  config: Configuration,
  onClose: () => void
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
      ...['baseUrl', 'apiKey'].map((key) =>
        toInput(SettingInputType.SHORT_INPUT, key as ConfigurationKey)
      ),
      toInput(SettingInputType.LONG_INPUT, 'systemMessage'),
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
      {
        type: SettingInputType.SECTION,
        label: (
          <>
            <ChatBubbleLeftEllipsisIcon className={TITLE_ICON_CLASSNAME} />
            Chat
          </>
        ),
      },
      toInput(SettingInputType.SHORT_INPUT, 'pasteLongTextToFileLen'),
      toInput(SettingInputType.CHECKBOX, 'pdfAsImage'),

      /* Performance */
      {
        type: SettingInputType.DELIMETER,
      },
      {
        type: SettingInputType.SECTION,
        label: (
          <>
            <RocketLaunchIcon className={ICON_CLASSNAME} />
            Performance
          </>
        ),
      },
      toInput(SettingInputType.CHECKBOX, 'showTokensPerSecond'),

      /* Reasoning */
      {
        type: SettingInputType.DELIMETER,
      },
      {
        type: SettingInputType.SECTION,
        label: (
          <>
            <ChatBubbleOvalLeftEllipsisIcon className={ICON_CLASSNAME} />
            Reasoning
          </>
        ),
      },
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
        type: SettingInputType.SECTION,
        label: (
          <>
            <ChatBubbleOvalLeftEllipsisIcon className={ICON_CLASSNAME} />
            Chats
          </>
        ),
      },
      {
        type: SettingInputType.CUSTOM,
        key: 'custom', // dummy key, won't be used
        component: () => <ImportExportComponent onClose={onClose} />,
      },
      {
        type: SettingInputType.DELIMETER,
      },
      {
        type: SettingInputType.SECTION,
        label: (
          <>
            <EyeIcon className={ICON_CLASSNAME} />
            Technical Demo
          </>
        ),
      },
      {
        type: SettingInputType.CUSTOM,
        key: 'custom', // dummy key, won't be used
        component: () => {
          const debugImportDemoConv = async () => {
            try {
              const res = await fetch('/demo-conversation.json');
              if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
              const demoConv = await res.json();
              StorageUtils.importDB(demoConv);
              onClose();
            } catch (error) {
              console.error('Failed to import demo conversation:', error);
            }
          };
          return (
            <button className="btn" onClick={debugImportDemoConv}>
              Import demo conversation
            </button>
          );
        },
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
      {
        type: SettingInputType.SECTION,
        label: (
          <>
            <CogIcon className={TITLE_ICON_CLASSNAME} />
            Generation
          </>
        ),
      },
      toInput(SettingInputType.CHECKBOX, 'overrideGenerationOptions'),
      ...['temperature', 'top_k', 'top_p', 'min_p', 'max_tokens'].map((key) =>
        toInput(
          SettingInputType.SHORT_INPUT,
          key as ConfigurationKey,
          !config['overrideGenerationOptions']
        )
      ),

      /* Samplers */
      {
        type: SettingInputType.DELIMETER,
      },
      {
        type: SettingInputType.SECTION,
        label: (
          <>
            <FunnelIcon className={ICON_CLASSNAME} />
            Samplers
          </>
        ),
      },
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
      {
        type: SettingInputType.DELIMETER,
      },
      {
        type: SettingInputType.SECTION,
        label: (
          <>
            <HandRaisedIcon className={ICON_CLASSNAME} />
            Penalties
          </>
        ),
      },
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
      {
        type: SettingInputType.DELIMETER,
      },
      {
        type: SettingInputType.SECTION,
        label: (
          <>
            <CpuChipIcon className={TITLE_ICON_CLASSNAME} />
            Custom
          </>
        ),
      },
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
  const [tabIdx, setTabIdx] = useState(0);

  // clone the config object to prevent direct mutation
  const [localConfig, setLocalConfig] = useState<Configuration>(
    JSON.parse(JSON.stringify(config))
  );
  const settingTabs = useMemo<SettingTab[]>(
    () => getSettingTabsConfiguration(localConfig, onClose),
    [localConfig]
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

  const onChange = (key: ConfigurationKey) => (value: string | boolean) => {
    // note: we do not perform validation here, because we may get incomplete value as user is still typing it
    setLocalConfig((prevConfig) => ({
      ...prevConfig,
      [key]: value,
    }));
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
                      onChange={(value) => onChange(field.key)(value)}
                    />
                  );
                case SettingInputType.CHECKBOX:
                  return (
                    <SettingsModalCheckbox
                      key={key}
                      configKey={field.key}
                      field={field}
                      value={!!localConfig[field.key]}
                      onChange={(value) => onChange(field.key)(value)}
                    />
                  );
                case SettingInputType.CUSTOM:
                  return (
                    <div key={key} className="mb-2">
                      {typeof field.component === 'string'
                        ? field.component
                        : React.createElement(field.component, {
                            value: localConfig[field.key],
                            onChange: (value: string | boolean) =>
                              onChange(field.key)(value),
                          })}
                    </div>
                  );
                case SettingInputType.SECTION:
                  return (
                    <div key={key} className="pb-2">
                      <h4>{field.label}</h4>
                    </div>
                  );
                case SettingInputType.DELIMETER:
                  return <div key={key} className="pb-3" />;
                default:
                  return null;
              }
            })}

            <p className="opacity-40 mb-6 text-sm mt-8">
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
    <label className="form-control">
      <div className="label inline text-sm">{field.label || configKey}</div>
      <textarea
        className="textarea textarea-bordered h-24 mb-2"
        placeholder={`Default: ${CONFIG_DEFAULT[configKey] || 'none'}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={field.disabled}
      />
      {field.note && (
        <div className="text-xs opacity-75 mt-1">{field.note}</div>
      )}
    </label>
  );
};

const SettingsModalShortInput: React.FC<
  BaseInputProps & { value: string | number }
> = ({ configKey, field, value, onChange }) => {
  return (
    <>
      {/* on mobile, we simply show the help message here */}
      {field.note && (
        <div className="block mb-1 opacity-75">
          <p className="text-xs">{field.note}</p>
        </div>
      )}
      <label className="input input-bordered join-item grow flex items-center gap-2 mb-2">
        <div className="dropdown dropdown-hover">
          <div tabIndex={0} role="button" className="font-bold hidden md:block">
            {field.label || configKey}
          </div>
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
    </>
  );
};

const SettingsModalCheckbox: React.FC<BaseInputProps & { value: boolean }> = ({
  configKey,
  field,
  value,
  onChange,
}) => {
  return (
    <>
      {field.note && (
        <div className="block mb-1 opacity-75">
          <p className="text-xs">{field.note}</p>
        </div>
      )}

      <div className="flex flex-row items-center mb-2">
        <input
          type="checkbox"
          className="toggle"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={field.disabled}
        />
        <span className="ml-2">{field.label || configKey}</span>
      </div>
    </>
  );
};
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

  return (
    <div className="grid grid-cols-[min-content_min-content] gap-2">
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
  );
};