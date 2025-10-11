import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown, Label, Textarea } from '../../../components';
import { CONFIG_DEFAULT } from '../../../config';
import { DropdownOption, SettingFieldInput } from '../../../types/settings';
import { normalizeUrl } from '../../../utils';

interface BaseInputProps {
  field: SettingFieldInput;
  onChange: (value: string | number | boolean) => void;
}

interface LabeledFieldProps {
  children: (props: LabeledFieldState) => React.ReactNode;
  configKey: string;
}
interface LabeledFieldState {
  label: string | React.ReactElement;
  note?: string | TrustedHTML;
}

function LabeledField({ children, configKey }: LabeledFieldProps) {
  const { t } = useTranslation();

  const { label, note } = useMemo(() => {
    if (!configKey) return { label: '', note: '' };
    return {
      label:
        t(`settings.parameters.${configKey}.label`, {
          defaultValue: configKey,
        }) || configKey,
      note: t(`settings.parameters.${configKey}.note`, {
        defaultValue: '',
      }),
    };
  }, [t, configKey]);

  return <>{children({ label, note })}</>;
}

export function SettingsModalLongInput({
  field,
  value,
  onChange,
}: BaseInputProps & { value: string }) {
  return (
    <LabeledField configKey={field.translateKey || field.key}>
      {({ label, note }) => (
        <Label variant="form-control" className="max-w-80">
          <div className="text-sm opacity-60 mb-1">{label}</div>
          <Textarea
            size="default"
            placeholder={`Default: ${CONFIG_DEFAULT[field.key] || 'none'}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={field.disabled}
          />
          {note && (
            <div
              className="text-xs opacity-75 mt-1"
              dangerouslySetInnerHTML={{ __html: note }}
            />
          )}
        </Label>
      )}
    </LabeledField>
  );
}

export function SettingsModalShortInput({
  field,
  value,
  onChange,
}: BaseInputProps & { value: string | number }) {
  return (
    <LabeledField configKey={field.translateKey || field.key}>
      {({ label, note }) => (
        <Label variant="form-control">
          <div tabIndex={0} role="button" className="font-bold mb-1 md:hidden">
            {label}
          </div>
          <Label variant="input-bordered">
            <div
              tabIndex={0}
              role="button"
              className="font-bold hidden md:block"
            >
              {label}
            </div>
            <input
              type="text"
              className="grow"
              placeholder={`Default: ${CONFIG_DEFAULT[field.key] || 'none'}`}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={field.disabled}
            />
          </Label>
          {note && (
            <div
              className="text-xs opacity-75 max-w-80"
              dangerouslySetInnerHTML={{ __html: note }}
            />
          )}
        </Label>
      )}
    </LabeledField>
  );
}

export function SettingsModalRangeInput({
  field,
  value,
  min,
  max,
  step,
  onChange,
}: BaseInputProps & {
  value: number;
  min: number;
  max: number;
  step: number;
}) {
  const values = useMemo(() => {
    const fractionDigits =
      Math.floor(step) === step ? 0 : step.toString().split('.')[1].length || 0;

    const length = Math.floor((max - min) / step) + 1;
    return Array.from({ length }, (_, i) =>
      Number(min + i * step).toFixed(fractionDigits)
    );
  }, [max, min, step]);

  return (
    <LabeledField configKey={field.translateKey || field.key}>
      {({ label, note }) => (
        <Label variant="form-control">
          <div tabIndex={0} role="button" className="font-bold mb-1 md:hidden">
            {label}
          </div>
          <Label variant="input-bordered">
            <div
              tabIndex={0}
              role="button"
              className="font-bold hidden md:block"
            >
              {label}
            </div>
            <div className="grow px-2">
              <input
                type="range"
                className="range range-xs [--range-fill:0]"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={field.disabled}
              />
              <div className="flex justify-between text-xs">
                {values.map((v) => (
                  <span key={v}>{v}</span>
                ))}
              </div>
            </div>
          </Label>
          {note && (
            <div
              className="text-xs opacity-75 max-w-80"
              dangerouslySetInnerHTML={{ __html: note }}
            />
          )}
        </Label>
      )}
    </LabeledField>
  );
}

export function SettingsModalCheckbox({
  field,
  value,
  onChange,
}: BaseInputProps & { value: boolean }) {
  return (
    <LabeledField configKey={field.translateKey || field.key}>
      {({ label, note }) => (
        <Label variant="form-control">
          <div className="flex flex-row items-center mb-1">
            <input
              type="checkbox"
              className="toggle"
              checked={value}
              onChange={(e) => onChange(e.target.checked)}
              disabled={field.disabled}
            />
            <span className="ml-2">{label}</span>
          </div>
          {note && (
            <div
              className="text-xs opacity-75 max-w-80 mt-1"
              dangerouslySetInnerHTML={{ __html: note }}
            />
          )}
        </Label>
      )}
    </LabeledField>
  );
}

export function SettingsModalDropdown({
  field,
  options,
  filterable = false,
  value,
  onChange,
}: BaseInputProps & {
  options: DropdownOption[];
  filterable?: boolean;
  value: string;
}) {
  const renderOption = (option: DropdownOption) => (
    <span className="truncate">
      {option.icon && (
        <img
          src={normalizeUrl(option.icon, import.meta.env.BASE_URL)}
          className="inline h-5 w-5 mr-2"
        />
      )}
      {option.label}
    </span>
  );

  const disabled = useMemo(() => options.length < 2, [options]);
  const selectedValue = useMemo(() => {
    const selectedOption = options.find((option) => option.value === value);
    return selectedOption ? (
      <span className="max-w-48 truncate text-nowrap">
        {selectedOption.label}
      </span>
    ) : (
      ''
    );
  }, [options, value]);

  useEffect(() => {
    if (
      options.length > 0 &&
      !options.some((option) => option.value === value)
    ) {
      onChange(options[0].value);
    }
  }, [options, value, onChange]);

  return (
    <LabeledField configKey={field.translateKey || field.key}>
      {({ label, note }) => (
        <div className="form-control flex flex-col justify-center mb-3">
          <div className="font-bold mb-1 md:hidden">{label}</div>
          <Label
            className={disabled ? 'bg-base-200' : ''}
            variant="input-bordered"
          >
            <div className="font-bold hidden md:block">{label}</div>

            <Dropdown
              className="grow"
              entity={field.key}
              options={options}
              filterable={filterable}
              optionsSize={filterable ? 'small' : 'medium'}
              currentValue={selectedValue}
              renderOption={renderOption}
              isSelected={(option) => value === option.value}
              onSelect={(option) => onChange(option.value)}
            />
          </Label>

          {note && (
            <div
              className="text-xs opacity-75 max-w-80"
              dangerouslySetInnerHTML={{ __html: note }}
            />
          )}
        </div>
      )}
    </LabeledField>
  );
}

export function SettingsSectionLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2">
      <h4>{children}</h4>
    </div>
  );
}

export function DelimeterComponent() {
  return <div className="pb-3" aria-label="delimeter" />;
}
