import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { isDev } from '../config';
import { classNames } from '../utils';

/**
 * A close button (X icon) with a default Tailwind CSS styling.
 */
export const XCloseButton: React.ElementType<
  React.ClassAttributes<HTMLButtonElement> &
    React.HTMLAttributes<HTMLButtonElement>
> = ({ className, ...props }) => (
  <button className={`btn btn-square btn-sm ${className ?? ''}`} {...props}>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  </button>
);

/**
 * Renders a link that opens in a new tab with proper security and accessibility attributes.
 *
 * @param href - URL to visit in new tab
 * @param children - Visible link text
 */
export const OpenInNewTab = ({
  href,
  children,
}: {
  href: string;
  children: string;
}) => (
  <a
    className="underline"
    href={href}
    target="_blank"
    rel="noopener noreferrer"
  >
    {children}
  </a>
);

/**
 * @deprecated Use `title` and `aria-label` props in button directly as utiliy classes.
 *
 * Wraps any button that needs a tooltip message.
 *
 * @param className - Optional additional classes to apply to the button
 * @param onClick - Optional click handler for the container element
 * @param onMouseLeave - Optional mouse leave handler for the inner button
 * @param children - React node to render inside the button
 * @param tooltipsContent - Text content to show in tooltip
 * @param disabled - Whether the button should be disabled
 */
export function BtnWithTooltips({
  className,
  onClick,
  onMouseLeave,
  children,
  tooltipsContent,
  disabled,
}: {
  className?: string;
  onClick?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
  tooltipsContent: string;
  disabled?: boolean;
}) {
  // the onClick handler is on the container, so screen readers can safely ignore the inner button
  // this prevents the label from being read twice
  return (
    <div
      className="tooltip tooltip-bottom"
      data-tip={tooltipsContent}
      role="button"
      onClick={onClick}
    >
      <button
        className={`${className ?? ''} flex items-center justify-center`}
        disabled={disabled}
        onMouseLeave={onMouseLeave}
        aria-hidden={true}
      >
        {children}
      </button>
    </div>
  );
}

export interface DropdownOption {
  value: string | number;
  label: string | React.ReactElement;
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
          aria-label={`Choose ${entity}`}
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
            aria-label={`Choose ${entity}`}
            aria-haspopup="listbox"
          >
            {currentValue}
            {!hideChevron && (
              <ChevronDownIcon className="inline h-5 w-5 ml-1" />
            )}
          </summary>

          {/* dropdown content */}
          <div className="dropdown-content rounded-box bg-base-100 max-w-60 p-2 shadow-2xl">
            {filterable && (
              <input
                type="text"
                placeholder={`Search ${entity}s...`}
                className="input input-sm w-full focus:outline-base-content/30 p-2 mb-2"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                autoFocus
              />
            )}

            {filteredOptions.length === 0 && (
              <div className="p-2 text-sm">No options found</div>
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
                    <button
                      className={classNames({
                        'btn btn-ghost w-full flex gap-2 justify-start font-normal px-2': true,
                        'btn-sm': optionsSize === 'small',
                        'btn-active': isSelected(option),
                      })}
                      onClick={handleSelect(option)}
                      aria-label={
                        isSelected(option)
                          ? `${option.label} selected`
                          : `${option.label} option`
                      }
                    >
                      {renderOption(option)}
                    </button>
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
