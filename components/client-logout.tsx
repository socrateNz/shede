'use client';

import { logout } from '@/app/actions/auth';
import { LogOut } from 'lucide-react';

export function ClientLogout() {
  return (
    <button
      onClick={() => logout()}
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
    >
      <LogOut className="w-4 h-4" />
      <span className="hidden sm:inline">Déconnexion</span>
    </button>
  );
}
