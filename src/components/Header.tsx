import { Bars3Icon, Cog8ToothIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import daisyuiThemes from 'daisyui/theme/object';
import { THEMES } from '../config';
import { useAppContext } from '../context/app.context';
import { classNames } from '../utils/misc';
import StorageUtils from '../utils/storage';
import { useInferenceContext } from '../context/inference.context';

export default function Header() {
  const [selectedTheme, setSelectedTheme] = useState(StorageUtils.getTheme());
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const { config, setShowSettings, saveConfig } = useAppContext();
  const { models } = useInferenceContext();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const setTheme = (theme: string) => {
    StorageUtils.setTheme(theme);
    setSelectedTheme(theme);
  };

  useEffect(() => {
    document.body.setAttribute('data-theme', selectedTheme);
    document.body.setAttribute(
      'data-color-scheme',
      daisyuiThemes[selectedTheme]?.['color-scheme'] ?? 'auto'
    );
  }, [selectedTheme]);

  useEffect(() => {
    if (isModelDropdownOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left,
        width: rect.width
      });
    }
  }, [isModelDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          !buttonRef.current?.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
        setModelSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="flex flex-row items-center py-2 sticky top-0 z-50">
      {/* open sidebar button */}
      <label
        htmlFor="toggle-drawer"
        className="btn btn-ghost w-8 h-8 p-0 xl:hidden"
      >
        <Bars3Icon className="h-5 w-5" />
      </label>

      {/* model information*/}
      <div className="grow text-nowrap overflow-hidden truncate ml-2 px-1 sm:px-4 py-0">
        <strong>
          {models.length === 1 && <>{models.find(m => m.id === config.model)?.name || config.model}</>}
          {models.length > 1 && (
            <div className="relative">
              <button
                ref={buttonRef}
                className="btn btn-ghost btn-sm flex items-center"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              >
                {models.find(m => m.id === config.model)?.name || config.model}
                <ChevronDownIcon className="h-4 w-4 ml-1" />
              </button>
            </div>
          )}
        </strong>
      </div>
      
      {/* Render dropdown as portal */}
      {isModelDropdownOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed top-0 left-0 w-full h-full bg-transparent pointer-events-none"
        >
          <div
            className="absolute bg-base-100 rounded-lg shadow-2xl z-[9999] border border-base-300 pointer-events-auto"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: '16rem'
            }}
          >
            <div className="p-2 sticky top-0 bg-base-100 z-10">
              <input
                type="text"
                placeholder="Search models..."
                className="input input-bordered input-sm w-full"
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-80 overflow-y-auto">
              {models
                .filter((m) =>
                  m.name.toLowerCase().includes(modelSearch.toLowerCase())
                )
                .map((m) => (
                  <button
                    key={m.id}
                    className="btn btn-ghost btn-sm w-full text-left justify-start px-4 py-2"
                    onClick={() => {
                      saveConfig({ ...config, model: m.id });
                      setIsModelDropdownOpen(false);
                      setModelSearch('');
                    }}
                  >
                    {m.name}
                  </button>
                ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* action buttons (top right) */}
      <div className="flex items-center mr-2">
        <div
          className="tooltip tooltip-bottom"
          data-tip="Settings"
          onClick={() => setShowSettings(true)}
        >
          <button
            className="btn btn-ghost w-8 h-8 p-0 rounded-full"
            aria-hidden={true}
          >
            {/* settings button */}
            <Cog8ToothIcon className="w-5 h-5" />
          </button>
        </div>

        {/* theme controller is copied from https://daisyui.com/components/theme-controller/ */}
        <div className="tooltip tooltip-bottom" data-tip="Themes">
          <div className="dropdown dropdown-end dropdown-bottom">
            <div
              tabIndex={0}
              role="button"
              className="btn btn-ghost m-1 w-8 h-8 p-0 rounded-full"
            >
              <div className="bg-base-100 grid shrink-0 grid-cols-2 gap-1 rounded-md p-1 shadow-sm">
                <div className="bg-base-content size-1 rounded-full"></div>{' '}
                <div className="bg-primary size-1 rounded-full"></div>{' '}
                <div className="bg-secondary size-1 rounded-full"></div>{' '}
                <div className="bg-accent size-1 rounded-full"></div>
              </div>
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content rounded-box z-[1] w-50 p-2 shadow-2xl h-80 text-sm overflow-y-auto"
            >
              <li>
                <button
                  className={classNames({
                    'flex gap-3 p-2 btn btn-sm btn-ghost': true,
                    'btn-active': selectedTheme === 'auto',
                  })}
                  onClick={() => setTheme('auto')}
                >
                  <div className="w-32 ml-6 pl-1 truncate text-left">auto</div>
                </button>
              </li>
              {THEMES.map((theme) => (
                <li key={theme}>
                  <button
                    className={classNames({
                      'flex gap-3 p-2 btn btn-sm btn-ghost': true,
                      'btn-active': selectedTheme === theme,
                    })}
                    data-set-theme={theme}
                    data-act-class="[&amp;_svg]:visible"
                    onClick={() => setTheme(theme)}
                  >
                    <div
                      data-theme={theme}
                      className="bg-base-100 grid shrink-0 grid-cols-2 gap-0.5 rounded-md p-1 shadow-sm"
                    >
                      <div className="bg-base-content size-1 rounded-full"></div>{' '}
                      <div className="bg-primary size-1 rounded-full"></div>{' '}
                      <div className="bg-secondary size-1 rounded-full"></div>{' '}
                      <div className="bg-accent size-1 rounded-full"></div>
                    </div>
                    <div className="w-32 truncate text-left">{theme}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </header>
  );
}
