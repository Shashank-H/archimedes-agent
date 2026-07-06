import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react';
import { AppDialog, AppDialogDescription, AppDialogTitle } from './AppDialog';

type DialogButtonVariant = 'primary' | 'danger';

type ConfirmationDialogOptions = {
  kicker?: string;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: DialogButtonVariant;
};

type PromptDialogOptions = {
  kicker?: string;
  title: string;
  description: string;
  inputLabel: string;
  defaultValue?: string;
  confirmLabel: string;
  cancelLabel?: string;
  validate?: (value: string) => string | null;
};

type ConfirmationDialogState = ConfirmationDialogOptions & {
  kind: 'confirm';
};

type PromptDialogState = PromptDialogOptions & {
  kind: 'prompt';
  value: string;
  error: string | null;
};

type DialogState = ConfirmationDialogState | PromptDialogState;

type DialogResolution = boolean | string | null;

const DEFAULT_CANCEL_LABEL = 'Cancel';
const PROMPT_TITLE_ID = 'app-prompt-dialog-title';
const PROMPT_DESCRIPTION_ID = 'app-prompt-dialog-description';
const PROMPT_ERROR_ID = 'app-prompt-dialog-error';
const CONFIRM_TITLE_ID = 'app-confirmation-dialog-title';
const CONFIRM_DESCRIPTION_ID = 'app-confirmation-dialog-description';

function defaultPromptValidation(value: string) {
  return value.trim().length === 0 ? 'Enter a value to continue.' : null;
}

export function useAppDialogs() {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const resolverRef = useRef<((value: DialogResolution) => void) | null>(null);

  const resolveDialog = useCallback((value: DialogResolution) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setDialog(null);
  }, []);

  const confirm = useCallback((options: ConfirmationDialogOptions) => new Promise<boolean>((resolve) => {
    resolverRef.current?.(false);
    resolverRef.current = (value) => resolve(value === true);
    setDialog({ kind: 'confirm', cancelLabel: DEFAULT_CANCEL_LABEL, variant: 'primary', ...options });
  }), []);

  const prompt = useCallback((options: PromptDialogOptions) => new Promise<string | null>((resolve) => {
    resolverRef.current?.(null);
    resolverRef.current = (value) => resolve(typeof value === 'string' ? value : null);
    const value = options.defaultValue ?? '';
    const validate = options.validate ?? defaultPromptValidation;
    setDialog({
      kind: 'prompt',
      cancelLabel: DEFAULT_CANCEL_LABEL,
      ...options,
      value,
      error: validate(value),
    });
  }), []);

  const updatePromptValue = useCallback((value: string) => {
    setDialog((current) => {
      if (!current || current.kind !== 'prompt') return current;
      const validate = current.validate ?? defaultPromptValidation;
      return { ...current, value, error: validate(value) };
    });
  }, []);

  const submitPrompt = useCallback(() => {
    if (!dialog || dialog.kind !== 'prompt') return;
    const validate = dialog.validate ?? defaultPromptValidation;
    const error = validate(dialog.value);
    if (error) {
      setDialog({ ...dialog, error });
      return;
    }
    resolveDialog(dialog.value);
  }, [dialog, resolveDialog]);

  const handlePromptSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitPrompt();
  }, [submitPrompt]);

  const dialogs = useMemo(() => {
    if (!dialog) return null;

    if (dialog.kind === 'confirm') {
      const buttonClassName = dialog.variant === 'danger'
        ? 'app-dialog-button-danger'
        : 'app-dialog-button-primary';

      return (
        <AppDialog
          open
          onOpenChange={(open) => {
            if (!open) resolveDialog(false);
          }}
          labelledBy={CONFIRM_TITLE_ID}
          describedBy={CONFIRM_DESCRIPTION_ID}
        >
          <header className="app-dialog-header">
            {dialog.kicker ? <p className="app-dialog-kicker">{dialog.kicker}</p> : null}
            <AppDialogTitle className="app-dialog-title" id={CONFIRM_TITLE_ID}>{dialog.title}</AppDialogTitle>
            <AppDialogDescription className="app-dialog-description" id={CONFIRM_DESCRIPTION_ID}>
              {dialog.description}
            </AppDialogDescription>
          </header>
          <div className="app-dialog-actions">
            <button type="button" onClick={() => resolveDialog(false)}>{dialog.cancelLabel}</button>
            <button type="button" className={buttonClassName} onClick={() => resolveDialog(true)}>
              {dialog.confirmLabel}
            </button>
          </div>
        </AppDialog>
      );
    }

    return (
      <AppDialog
        open
        onOpenChange={(open) => {
          if (!open) resolveDialog(null);
        }}
        labelledBy={PROMPT_TITLE_ID}
        describedBy={dialog.error ? `${PROMPT_DESCRIPTION_ID} ${PROMPT_ERROR_ID}` : PROMPT_DESCRIPTION_ID}
      >
        <form onSubmit={handlePromptSubmit}>
          <header className="app-dialog-header">
            {dialog.kicker ? <p className="app-dialog-kicker">{dialog.kicker}</p> : null}
            <AppDialogTitle className="app-dialog-title" id={PROMPT_TITLE_ID}>{dialog.title}</AppDialogTitle>
            <AppDialogDescription className="app-dialog-description" id={PROMPT_DESCRIPTION_ID}>
              {dialog.description}
            </AppDialogDescription>
          </header>
          <div className="app-dialog-body">
            <label className="app-dialog-field">
              <span className="app-dialog-label">{dialog.inputLabel}</span>
              <input
                autoFocus
                className="app-dialog-input"
                value={dialog.value}
                aria-invalid={Boolean(dialog.error)}
                aria-describedby={dialog.error ? PROMPT_ERROR_ID : undefined}
                onChange={(event) => updatePromptValue(event.target.value)}
              />
            </label>
            {dialog.error ? <p className="app-dialog-error" id={PROMPT_ERROR_ID}>{dialog.error}</p> : null}
          </div>
          <div className="app-dialog-actions">
            <button type="button" onClick={() => resolveDialog(null)}>{dialog.cancelLabel}</button>
            <button type="submit" className="app-dialog-button-primary" disabled={Boolean(dialog.error)}>
              {dialog.confirmLabel}
            </button>
          </div>
        </form>
      </AppDialog>
    );
  }, [dialog, handlePromptSubmit, resolveDialog, submitPrompt, updatePromptValue]);

  return { confirm, prompt, dialogs };
}
