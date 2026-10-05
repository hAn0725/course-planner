import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface TermSelectorProps {
  terms: string[];
  activeTerm: string;
  onSelect: (term: string) => void;
}

function presentTerm(term: string) {
  const match = term.match(/^(\d{4})-(\d{4})-(\d)\s*\((\d{4})(春季|秋季)学期\)$/);
  if (!match) return { title: term, detail: '' };

  const [, startYear, endYear, semester, labelYear, season] = match;
  return {
    title: `${labelYear} ${season}学期`,
    detail: `${startYear}—${endYear}学年 · 第${semester}学期`,
  };
}

export const TermSelector: React.FC<TermSelectorProps> = ({ terms, activeTerm, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const selectedIndex = Math.max(0, terms.indexOf(activeTerm));
  const selected = presentTerm(activeTerm);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [isOpen]);

  const openAndFocus = (index = selectedIndex) => {
    setIsOpen(true);
    window.requestAnimationFrame(() => optionRefs.current[index]?.focus());
  };

  const closeAndReturnFocus = () => {
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openAndFocus(selectedIndex);
    }
  };

  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const next = (index + direction + terms.length) % terms.length;
      optionRefs.current[next]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : terms.length - 1;
      optionRefs.current[next]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeAndReturnFocus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const term = terms[index];
      if (term) {
        onSelect(term);
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
  };

  return (
    <div
      className="term-select-control"
      ref={rootRef}
      onBlur={event => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setIsOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        id="active-term-select"
        type="button"
        className={`term-select-trigger ${isOpen ? 'is-open' : ''}`}
        aria-label={`当前学期：${selected.title}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="term-select-options"
        onClick={() => isOpen ? setIsOpen(false) : openAndFocus()}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="term-select-copy">
          <span className="term-select-title">{selected.title}</span>
          {selected.detail && <span className="term-select-detail">{selected.detail}</span>}
        </span>
        <ChevronDown aria-hidden="true" className="term-select-chevron" size={16} />
      </button>

      {isOpen && (
        <div id="term-select-options" className="term-select-menu" role="listbox" aria-label="选择学期">
          {terms.map((term, index) => {
            const option = presentTerm(term);
            const isSelected = term === activeTerm;
            return (
              <div
                key={term}
                ref={element => { optionRefs.current[index] = element; }}
                className={`term-select-option ${isSelected ? 'is-selected' : ''}`}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                onClick={() => {
                  onSelect(term);
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                onKeyDown={event => handleOptionKeyDown(event, index)}
              >
                <span className="term-option-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="term-option-copy">
                  <span className="term-option-title">{option.title}</span>
                  {option.detail && <span className="term-option-detail">{option.detail}</span>}
                </span>
                {isSelected && <Check aria-hidden="true" className="term-option-check" size={15} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
