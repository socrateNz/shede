'use client';

import { useState } from 'react';
import { Check, Copy, Sparkles } from 'lucide-react';

export function CopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-white"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? copiedLabel : label}
    </button>
  );
}

/** En-tête de la documentation : copie toute la page en Markdown pour un assistant IA. */
export function CopyPromptButton({ text, label, copiedLabel, hint }: { text: string; label: string; copiedLabel: string; hint: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={hint}
      aria-label={copied ? copiedLabel : label}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-purple-300 hover:text-purple-700"
    >
      {copied ? <Check className="h-4 w-4 text-green-600" aria-hidden /> : <Sparkles className="h-4 w-4 text-purple-600" aria-hidden />}
      <span className="hidden sm:inline">{copied ? copiedLabel : label}</span>
    </button>
  );
}
