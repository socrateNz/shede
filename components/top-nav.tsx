'use client';

import { SessionPayload } from '@/lib/auth';
import { Bell, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface TopNavProps {
  session: SessionPayload;
}

export function TopNav({ session }: TopNavProps) {
  return (
    <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search..."
            className="pl-10 bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-200">
          <Bell className="w-5 h-5" />
        </Button>
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
          <span className="text-white text-sm font-medium">
            {session.email.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>
    </header>
  );
}
