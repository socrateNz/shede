import { create } from 'zustand';
import { Structure } from './supabase';

interface AppState {
  activeStructure: Structure | null;
  setActiveStructure: (structure: Structure | null) => void;
  hasModule: (moduleName: string) => boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeStructure: null,
  setActiveStructure: (structure) => set({ activeStructure: structure }),
  hasModule: (moduleName) => {
    const { activeStructure } = get();
    if (!activeStructure || !activeStructure.modules) return false;
    return activeStructure.modules.includes(moduleName);
  },
}));
