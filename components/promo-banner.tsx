'use client';

import { Percent, Tag, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Promotion {
  id: string;
  name: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  scope: 'PRODUCT' | 'ORDER';
  min_order_amount?: number;
  structure_id?: string;
  structures?: { name: string;[key: string]: any };
  products?: { name: string };
}

export function PromoBanner({ promotions, isGlobal = false }: { promotions: Promotion[], isGlobal?: boolean }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // For structure pages, we only show ORDER scope in the banner (products have their own badges).
  // For the global portal, we show all promotions.
  const displayPromos = isGlobal ? promotions : promotions.filter(p => p.scope === 'ORDER');

  useEffect(() => {
    if (displayPromos.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % displayPromos.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [displayPromos.length]);

  if (displayPromos.length === 0) return null;

  const current = displayPromos[currentIndex];

  if (isGlobal) {
  }

  const bannerContent = (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 p-6 shadow-lg mb-8 ${isGlobal ? 'hover:shadow-indigo-500/30' : ''}`}>
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-24 w-24 rounded-full bg-blue-400/20 blur-2xl" />

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="relative flex flex-col md:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
              <Zap className="h-6 w-6 text-yellow-300 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white leading-tight">
                {current.name}
              </h3>
              {isGlobal && current.structures && (
                <p className="text-blue-200 text-sm font-semibold mb-1">
                  Chez {current.structures.name}
                </p>
              )}
              <p className="text-blue-100 text-sm font-medium">
                {current.scope === 'PRODUCT'
                  ? (current.type === 'PERCENTAGE' ? `-${current.value}% sur ${current.products?.name || 'ce produit'} !` : `-${current.value} FCFA sur ${current.products?.name || 'ce produit'} !`)
                  : (current.type === 'PERCENTAGE' ? `-${current.value}% sur votre commande !` : `-${current.value} FCFA offerts dès aujourd'hui !`)
                }
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-blue-700 text-sm font-bold shadow-sm">
              <Tag className="h-4 w-4" />
              {current.min_order_amount && current.min_order_amount > 0
                ? `Dès ${current.min_order_amount} FCFA`
                : 'Sans minimum d\'achat'}
            </div>
            {displayPromos.length > 1 && (
              <div className="mt-3 flex gap-1.5">
                {displayPromos.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${i === currentIndex ? 'w-4 bg-white' : 'bg-white/40'
                      }`}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );

  if (isGlobal && current.structure_id) {
    return (
      <Link href={`/client/structure/${current.structure_id}`} className="block transition-transform hover:-translate-y-1">
        {bannerContent}
      </Link>
    );
  }

  return bannerContent;
}

