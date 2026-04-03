'use client';

import { useCartStore } from '@/lib/cart-store';
import { ShoppingCart } from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export function CartBadge({ mobile = false }: { mobile?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const items = useCartStore((state) => state.items);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const count = items.reduce((acc, item) => acc + item.quantity, 0);

  if (mobile) {
    return (
      <Link href="/cart" className="text-slate-600 text-sm font-medium flex flex-col items-center relative">
        <span className="text-xl">🛒</span>
        Panier
        {mounted && count > 0 && (
          <span className="absolute top-0 right-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 border border-white rounded-full -translate-y-2 translate-x-3">
            {count}
          </span>
        )}
      </Link>
    );
  }

  if (!mounted) {
    return (
      <Link href="/cart" className="relative p-2 rounded-full hover:bg-slate-100 transition-colors">
        <ShoppingCart className="w-6 h-6 text-slate-700" />
      </Link>
    );
  }

  return (
    <Link href="/cart" className="relative p-2 rounded-full hover:bg-slate-100 transition-colors">
      <ShoppingCart className="w-6 h-6 text-slate-700" />
      {count > 0 && (
        <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 border-2 border-white rounded-full -translate-y-1 translate-x-1">
          {count}
        </span>
      )}
    </Link>
  );
}
