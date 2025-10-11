import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isDev } from '../config';
import { classNames } from '../utils';
import { Button } from './Button';
import { Icon } from './Icon';

export interface DropdownOption {
  value: string | number;
  label: string | ReactNode;
}
export interface DropdownProps<T> {
  className?: string;
  entity: string;
  options: T[];
  filterable?: boolean;
  hideChevron?: boolean;
  optionsSize?: 'medium' | 'small';
  align?: 'start' | 'center' | 'end';
  placement?: 'top' | 'bottom' | 'left' | 'right';
  currentValue: ReactNode;
  renderOption: (option: T) => ReactNode;
  isSelected: (option: T) => boolean;
  onSelect: (option: T) => void;
}
/**
 * A customizable dropdown component that supports filtering and custom rendering of options.
 *
 * @template T - The type of option items. Must be an object with 'value' and 'label' properties.
 *
 * @param className - Optional CSS class names to apply to the dropdown container.
 * @param entity - The name of the entity the dropdown represents (used for labeling and accessibility).
 * @param options - An array of available options to display in the dropdown.
 * @param currentValue - The JSX representation of the currently selected value to display in the dropdown trigger.
 * @param renderOption - A function that takes an option and returns a JSX element to render for that option.
 * @param isSelected - A function that takes a value and returns whether it is currently selected.
 * @param onSelect - A callback function triggered when a new option is selected.
 */
export function Dropdown<T extends DropdownOption>({
  className,
  entity,
  options,
  filterable = false,
  hideChevron = false,
  optionsSize = 'medium',
  align = 'end',
  placement = 'bottom',
  currentValue,
  renderOption,
  isSelected,
  onSelect,
}: DropdownProps<T>) {
  const { t } = useTranslation();
  const dropdownRef = useRef<HTMLDetailsElement>(null);
  const [filter, setFilter] = useState<string>('');
  const isDisabled = useMemo<boolean>(() => options.length < 2, [options]);
  const filteredOptions = useMemo(() => {
    if (!filterable || filter.trim() === '') return options;
    return options.filter((option) => {
      if (typeof option.label === 'string') {
        return option.label.toLowerCase().includes(filter.trim().toLowerCase());
      } else {
        return true;
      }
    });
  }, [options, filter, filterable]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdown = dropdownRef.current;
      if (dropdown && !dropdown.contains(event.target as Node)) {
        dropdown.removeAttribute('open');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: T) => () => {
    onSelect(option);
    dropdownRef.current?.removeAttribute('open');
  };

  if (!Array.isArray(options)) {
    if (isDev) console.warn(`${entity} options must be an array`);
    return null;
  }

  return (
    <div className={`${className ?? ''} flex`}>
      {/* disabled dropdown */}
      {isDisabled && (
        <div
          className="grow truncate"
          title={entity}
          aria-label={t('dropdown.chooseEntity', { entity })}
        >
          {currentValue}
        </div>
      )}

      {/* dropdown */}
      {!isDisabled && (
        <details
          ref={dropdownRef}
          className={`grow dropdown dropdown-${align} dropdown-${placement}`}
        >
          <summary
            className="grow truncate flex justify-between items-center cursor-pointer"
            title={entity}
            aria-label={t('dropdown.chooseEntity', { entity })}
            aria-haspopup="listbox"
          >
            {currentValue}
            {!hideChevron && (
              <Icon icon="LuChevronDown" variant="rightside" size="md" />
            )}
          </summary>

          {/* dropdown content */}
          <div className="dropdown-content rounded-box bg-base-100 max-w-60 p-2 shadow-2xl">
            {filterable && (
              <input
                type="text"
                placeholder={t('dropdown.searchPlaceholder', { entity })}
                className="input input-sm w-full focus:outline-base-content/30 p-2 mb-2"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                autoFocus
              />
            )}

            {filteredOptions.length === 0 && (
              <div className="p-2 text-sm">{t('dropdown.noOptions')}</div>
            )}

            {filteredOptions.length > 0 && (
              <ul
                className={classNames({
                  'flex flex-col gap-1 overflow-y-auto': true,
                  'max-h-72': filterable,
                  'max-h-80': !filterable,
                })}
              >
                {filteredOptions.map((option) => (
                  <li key={option.value}>
                    <Button
                      className={classNames({
                        'w-full flex gap-2 justify-start font-normal px-2': true,
                        'btn-sm': optionsSize === 'small',
                        'btn-active': isSelected(option),
                      })}
                      variant="ghost"
                      onClick={handleSelect(option)}
                      aria-label={`${option.label} ${isSelected(option) ? 'selected' : 'option'}`}
                    >
                      {renderOption(option)}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
