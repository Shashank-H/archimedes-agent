import { useId } from 'react';
import customSelectStyles from './CustomSelect.module.css';
import { useCustomSelect, type SelectOption } from '../hooks/useCustomSelect';

type CustomSelectProps = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
};

export function CustomSelect({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  className = '',
}: CustomSelectProps) {
  const listboxId = useId();
  const {
    rootRef,
    isOpen,
    activeIndex,
    selectedOption,
    toggle,
    selectOption,
    onKeyDown,
  } = useCustomSelect({ value, options, disabled, onChange });

  return (
    <div
      ref={rootRef}
      className={`custom-select ${customSelectStyles.moduleAnchor} ${className}`.trim()}
      data-open={isOpen ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : 'false'}
    >
      <button
        type="button"
        className="custom-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={onKeyDown}
      >
        <span className="custom-select-value">{selectedOption?.label ?? 'Select'}</span>
        <span className="custom-select-caret" aria-hidden="true" />
      </button>

      {isOpen && (
        <div id={listboxId} className="custom-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <button
                type="button"
                key={option.value}
                className="custom-select-option"
                role="option"
                aria-selected={isSelected}
                data-active={index === activeIndex ? 'true' : 'false'}
                data-selected={isSelected ? 'true' : 'false'}
                onClick={() => selectOption(option)}
              >
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
