import { create } from 'zustand';

export interface SelectedAccompaniment {
  id: string;
  name: string;
  price: number;
  quantity: number;
  accompaniment_id: string;
}

export interface CartItem {
  id: string; // Composite ID to allow same product with different accompaniments
  productId: string;
  name: string;
  price: number;
  quantity: number;
  selectedAccompaniments?: SelectedAccompaniment[];
}

interface CartStore {
  items: CartItem[];
  structureId: string | null;
  addItem: (item: CartItem, structureId: string) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  structureId: null,
  addItem: (item, structureId) => set((state) => {
    if (state.structureId && state.structureId !== structureId) {
      // Clear cart if switching structures
      return { items: [item], structureId };
    }
    const existing = state.items.find(i => i.id === item.id);
    if (existing) {
      return { 
        items: state.items.map(i => i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i),
        structureId 
      };
    }
    return { items: [...state.items, item], structureId };
  }),
  removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.id !== id) })),
  updateQuantity: (id, quantity) => set((state) => ({
    items: quantity <= 0 
      ? state.items.filter(i => i.id !== id)
      : state.items.map(i => i.id === id ? { ...i, quantity } : i)
  })),
  clearCart: () => set({ items: [] }),
  getTotal: () => get().items.reduce((total, item) => {
    const accompanimentsTotal = item.selectedAccompaniments?.reduce(
      (sum, acc) => sum + (acc.price * acc.quantity), 0
    ) || 0;
    return total + ((item.price + accompanimentsTotal) * item.quantity);
  }, 0),
}));
