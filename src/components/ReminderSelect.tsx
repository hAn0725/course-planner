import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface ReminderSelectOption {
  value: string;
  label: string;
}

interface ReminderSelectProps {
  value: string;
  options: ReminderSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  searchable?: boolean;
}

interface MenuPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

export const ReminderSelect: React.FC<ReminderSelectProps> = ({
  value,
  options,
  onChange,
  ariaLabel,
  searchable = false,
}) => {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));
  const selected = options.find(option => option.value === value);
  const filteredOptions = options.filter(option => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const gutter = 10;
    const preferredWidth = Math.max(rect.width, searchable ? 320 : 220);
    const width = Math.min(preferredWidth, Math.max(180, window.innerWidth - gutter * 2));
    const left = Math.max(gutter, Math.min(rect.left, window.innerWidth - width - gutter));
    const maxHeight = Math.min(searchable ? 320 : 250, Math.max(150, window.innerHeight - gutter * 2));
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    const opensAbove = below < Math.min(maxHeight, 180) && above > below;
    const availableHeight = Math.max(120, Math.min(maxHeight, opensAbove ? above : below));
    const top = opensAbove
      ? Math.max(gutter, rect.top - availableHeight - 6)
      : Math.min(window.innerHeight - gutter - availableHeight, rect.bottom + 6);

    setPosition({ left, top, width, maxHeight: availableHeight });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handleViewportChange = () => updatePosition();
    window.addEventListener('resize', handleViewportChange);
    document.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      document.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
      setQuery('');
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    window.requestAnimationFrame(() => {
      if (searchable) searchRef.current?.focus();
      else optionRefs.current[selectedIndex]?.focus();
    });
  }, [isOpen, searchable, selectedIndex]);

  const closeAndReturnFocus = () => {
    setIsOpen(false);
    setQuery('');
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const choose = (option: ReminderSelectOption) => {
    onChange(option.value);
    closeAndReturnFocus();
  };

  const open = () => {
    setQuery('');
    setPosition(null);
    setIsOpen(true);
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isOpen) open();
      else optionRefs.current[0]?.focus();
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      optionRefs.current[0]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeAndReturnFocus();
    } else if (event.key === 'Enter' && filteredOptions[0]) {
      event.preventDefault();
      choose(filteredOptions[0]);
    }
  };

  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const next = Math.max(0, Math.min(filteredOptions.length - 1, index + direction));
      optionRefs.current[next]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      optionRefs.current[event.key === 'Home' ? 0 : filteredOptions.length - 1]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeAndReturnFocus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = filteredOptions[index];
      if (option) choose(option);
    }
  };

  return (
    <div className="reminder-select">
      <button
        ref={triggerRef}
        type="button"
        className={`reminder-select-trigger ${isOpen ? 'is-open' : ''}`}
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`reminder-select-list-${id}`}
        onClick={() => isOpen ? closeAndReturnFocus() : open()}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="reminder-select-value">{selected?.label ?? ''}</span>
        <ChevronDown aria-hidden="true" className="reminder-select-chevron" size={15} />
      </button>

      {isOpen && position && createPortal(
        <div
          ref={menuRef}
          className={`reminder-select-popover ${searchable ? 'is-searchable' : ''}`}
          style={{ left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight }}
        >
          {searchable && (
            <label className="reminder-select-search">
              <Search aria-hidden="true" size={15} />
              <input
                ref={searchRef}
                type="search"
                aria-label={`筛选${ariaLabel}`}
                placeholder={ariaLabel}
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
            </label>
          )}
          <div id={`reminder-select-list-${id}`} className="reminder-select-options" role="listbox" aria-label={ariaLabel}>
            {filteredOptions.length ? filteredOptions.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  ref={element => { optionRefs.current[index] = element; }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`reminder-select-option ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => choose(option)}
                  onKeyDown={event => handleOptionKeyDown(event, index)}
                >
                  <span>{option.label}</span>
                  {isSelected && <Check aria-hidden="true" size={15} />}
                </button>
              );
            }) : <div className="reminder-select-empty">没有匹配的课程</div>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};
