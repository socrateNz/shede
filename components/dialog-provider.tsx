'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { useT } from '@/lib/i18n/client';

// Dialogues de l'application (shadcn AlertDialog) à la place de alert(),
// confirm() et prompt() du navigateur, avec la même simplicité d'usage :
//   const dialogs = useDialogs();
//   if (!(await dialogs.confirm({ description: '…', destructive: true }))) return;
//   await dialogs.alert({ description: error, variant: 'error' });
//   const reason = await dialogs.prompt({ description: '…' }); // null si annulé

type Tone = 'dark' | 'light';

type BaseOptions = {
  title?: string;
  description: string;
  /** light : écrans clients (fond clair) ; dark par défaut (back-office). */
  tone?: Tone;
};
export type ConfirmOptions = BaseOptions & { confirmLabel?: string; cancelLabel?: string; destructive?: boolean };
export type AlertOptions = BaseOptions & { variant?: 'info' | 'error'; okLabel?: string };
export type PromptOptions = BaseOptions & {
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  /** Réponse obligatoire (sinon une réponse vide est acceptée). */
  required?: boolean;
  /** Bouton de validation rouge (action destructrice). */
  destructive?: boolean;
  maxLength?: number;
};

type Request =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: 'alert'; options: AlertOptions; resolve: () => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void };

type Dialogs = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const DialogsContext = createContext<Dialogs | null>(null);

export function useDialogs() {
  const context = useContext(DialogsContext);
  if (!context) throw new Error('useDialogs() doit être utilisé dans <DialogProvider>');
  return context;
}

const TONES: Record<Tone, { content: string; description: string; cancel: string; input: string }> = {
  dark: {
    content: 'border-slate-700 bg-slate-800 text-slate-100',
    description: 'text-slate-300',
    cancel: 'border-slate-600 bg-transparent text-slate-200 hover:bg-slate-700 hover:text-white',
    input: 'border-slate-600 bg-slate-900/50 text-slate-50 placeholder:text-slate-500',
  },
  light: {
    content: 'border-slate-200 bg-white text-slate-900',
    description: 'text-slate-600',
    cancel: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
    input: 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400',
  },
};

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  // File d'attente : un seul dialogue à la fois, les suivants attendent.
  const [queue, setQueue] = useState<Request[]>([]);
  const [value, setValue] = useState('');
  // Demandes déjà répondues : une fermeture en double (bouton puis onOpenChange) est ignorée.
  const answered = useRef(new WeakSet<Request>());
  const current = queue[0];

  // Valeur initiale du champ à chaque nouveau dialogue
  useEffect(() => {
    setValue(current?.kind === 'prompt' ? current.options.defaultValue ?? '' : '');
  }, [current]);

  const push = (request: Request) => setQueue((q) => [...q, request]);

  const dialogs = useRef<Dialogs>({
    confirm: (options) => new Promise((resolve) => push({ kind: 'confirm', options, resolve })),
    alert: (options) => new Promise((resolve) => push({ kind: 'alert', options, resolve })),
    prompt: (options) => new Promise((resolve) => push({ kind: 'prompt', options, resolve })),
  }).current;

  /** Ferme le dialogue courant avec sa réponse, puis passe au suivant. */
  function finish(answer: 'ok' | 'cancel') {
    const request = current;
    if (!request || answered.current.has(request)) return;
    answered.current.add(request);
    if (request.kind === 'confirm') request.resolve(answer === 'ok');
    else if (request.kind === 'alert') request.resolve();
    else request.resolve(answer === 'ok' ? value.trim() : null);
    setQueue((q) => q.filter((r) => r !== request));
  }

  const tone = TONES[current?.options.tone ?? 'dark'];
  const destructive = (current?.kind === 'confirm' || current?.kind === 'prompt') && Boolean(current.options.destructive);
  const isError = current?.kind === 'alert' && current.options.variant === 'error';
  const promptBlocked = current?.kind === 'prompt' && current.options.required && !value.trim();
  const title =
    current?.options.title ??
    (current?.kind === 'alert' ? (isError ? t('common.errorTitle') : t('common.infoTitle')) : t('common.confirmTitle'));

  return (
    <DialogsContext.Provider value={dialogs}>
      {children}
      <AlertDialog open={Boolean(current)} onOpenChange={(open) => !open && finish('cancel')}>
        {current && (
          <AlertDialogContent className={`sm:max-w-md ${tone.content}`}>
            <AlertDialogHeader>
              <AlertDialogTitle className={isError ? 'text-red-400' : undefined}>{title}</AlertDialogTitle>
              <AlertDialogDescription className={`whitespace-pre-line ${tone.description}`}>{current.options.description}</AlertDialogDescription>
            </AlertDialogHeader>

            {current.kind === 'prompt' && (
              <form
                id="dialog-prompt"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!promptBlocked) finish('ok');
                }}
                className="space-y-1.5"
              >
                {current.options.label && <label htmlFor="dialog-prompt-input" className="text-sm">{current.options.label}</label>}
                <Input
                  id="dialog-prompt-input"
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={current.options.placeholder}
                  maxLength={current.options.maxLength ?? 300}
                  className={tone.input}
                />
              </form>
            )}

            <AlertDialogFooter>
              {current.kind !== 'alert' && (
                <AlertDialogCancel onClick={() => finish('cancel')} className={tone.cancel}>
                  {(current.kind === 'confirm' && current.options.cancelLabel) || t('common.cancel')}
                </AlertDialogCancel>
              )}
              <AlertDialogAction
                type={current.kind === 'prompt' ? 'submit' : 'button'}
                form={current.kind === 'prompt' ? 'dialog-prompt' : undefined}
                disabled={promptBlocked}
                onClick={(e) => {
                  // Le formulaire du prompt gère lui-même la validation
                  if (current.kind === 'prompt') {
                    e.preventDefault();
                    if (!promptBlocked) finish('ok');
                    return;
                  }
                  finish('ok');
                }}
                className={destructive ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-blue-600 text-white hover:bg-blue-700'}
              >
                {current.kind === 'alert'
                  ? current.options.okLabel ?? t('common.ok')
                  : current.options.confirmLabel ?? t('common.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </DialogsContext.Provider>
  );
}
