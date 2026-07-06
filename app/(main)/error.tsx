'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Shede] Erreur globale :', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="p-5 bg-red-500/10 rounded-full ring-1 ring-red-500/20">
            <AlertCircle className="w-12 h-12 text-red-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">
          Une erreur est survenue
        </h2>
        <p className="text-slate-400 mb-2 text-sm">
          {error.message || "Quelque chose s'est mal passé. Veuillez réessayer."}
        </p>
        {error.digest && (
          <p className="text-xs text-slate-600 font-mono mb-6">
            Réf : {error.digest}
          </p>
        )}
        <Button
          onClick={reset}
          className="bg-blue-600 hover:bg-blue-700 gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Réessayer
        </Button>
      </div>
    </div>
  );
}
