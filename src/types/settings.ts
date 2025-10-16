import { ReactNode } from 'react';
import { ConfigurationKey } from '.';

export enum SettingInputType {
  SHORT_INPUT,
  LONG_INPUT,
  RANGE_INPUT,
  CHECKBOX,
  DROPDOWN,
  CUSTOM,
  SECTION,
}

export type SettingFieldInputType = Exclude<
  SettingInputType,
  SettingInputType.CUSTOM | SettingInputType.SECTION
>;

export interface BaseSettingField {
  key: ConfigurationKey;
  disabled?: boolean;
  translateKey?: string;
  [key: string]: unknown;
}

export interface SettingFieldInput extends BaseSettingField {
  type: SettingFieldInputType;
}

export interface SettingFieldCustom {
  type: SettingInputType.CUSTOM;
  key:
    | ConfigurationKey
    | 'custom'
    | 'language'
    | 'import-export'
    | 'preset-manager'
    | 'fetch-models'
    | 'theme-manager'
    | 'voice-manager';
  component:
    | string
    | React.FC<{
        value: string | boolean | number;
        onChange: (value: string | boolean) => void;
      }>
    | 'delimeter';
}

export interface DropdownOption {
  value: string | number;
  label: string;
  icon?: string;
}

export interface SettingFieldDropdown extends BaseSettingField {
  type: SettingInputType.DROPDOWN;
  options: DropdownOption[];
  filterable: boolean;
}

export interface SettingSection {
  type: SettingInputType.SECTION;
  label: string | ReactNode;
}

export type SettingField =
  | SettingFieldInput
  | SettingFieldCustom
  | SettingSection
  | SettingFieldDropdown;

export interface SettingTab {
  title: ReactNode;
  fields: SettingField[];
}
