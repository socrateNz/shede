'use client';

import { Product } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2, MoreVertical, CheckCircle, XCircle, Package, Tag, ImageIcon, TruckIcon } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deleteProduct } from '@/app/actions/products';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PageNav } from './page-nav';
import { UrlSearch, UrlSelect } from './url-filters';
import type { PageMeta } from '@/lib/pagination';
import { useT } from '@/lib/i18n/client';
import { useDialogs } from '@/components/dialog-provider';
import { categoryLabel, sortCategoryTree, type CategoryNode } from '@/lib/category-tree';

interface ProductsListProps {
  /** Une page de produits, déjà filtrée par le serveur. */
  products: Product[];
  meta: PageMeta<unknown>;
  /** Toutes les catégories du point (pour le filtre et les libellés « Catégorie › Sous-catégorie »). */
  categories?: CategoryNode[];
  onProductDeleted?: () => void;
}

export function ProductsList({ products, meta, categories = [], onProductDeleted }: ProductsListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { t, format } = useT();
  const dialogs = useDialogs();
  const router = useRouter();

  // Filtre : catégories dans l'ordre du point, sous-catégories en retrait
  const categoryOptions = useMemo(() => sortCategoryTree(categories), [categories]);

  const handleDelete = async (productId: string) => {
    if (!(await dialogs.confirm({ description: t('products.list.confirmDelete'), destructive: true }))) return;

    setDeletingId(productId);
    const res = await deleteProduct(productId);
    setDeletingId(null);
    if (!res.success) {
      await dialogs.alert({ description: res.error ?? '', variant: 'error' });
    } else {
      onProductDeleted?.();
      router.refresh();
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'plat':
        return '🍽️';
      case 'boisson':
        return '🥤';
      case 'dessert':
        return '🍰';
      default:
        return '📦';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <UrlSearch placeholder={t('products.list.search')} className="min-w-48 flex-1" />
        {categoryOptions.length > 0 && (
          <UrlSelect
            param="category"
            label={t('products.list.allCategories')}
            options={[
              { value: '', label: t('products.list.allCategories') },
              ...categoryOptions.map((c) => ({ value: c.id, label: c.parent_id ? `  › ${c.name}` : c.name })),
              { value: 'NONE', label: t('products.list.noCategory') },
            ]}
          />
        )}
        <UrlSelect
          param="destination"
          label={t('products.list.allDestinations')}
          options={[
            { value: '', label: t('products.list.allDestinations') },
            { value: 'CUISINE', label: t('products.destination.CUISINE') },
            { value: 'BAR', label: t('products.destination.BAR') },
          ]}
        />
      </div>
      <div className="rounded-xl border border-slate-700/50 overflow-hidden bg-slate-800/30">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent bg-slate-800/50">
              <TableHead className="text-slate-300 font-semibold">{t('products.list.colName')}</TableHead>
              <TableHead className="text-slate-300 font-semibold">{t('products.list.colCategory')}</TableHead>
              <TableHead className="text-slate-300 font-semibold">{t('products.list.colDestination')}</TableHead>
              <TableHead className="text-slate-300 font-semibold text-right">{t('products.list.colPrice')}</TableHead>
            <TableHead className="text-slate-300 font-semibold">{t('products.list.colAvailability')}</TableHead>
            <TableHead className="text-slate-300 font-semibold text-right">{t('products.list.colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 && (
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableCell colSpan={99} className="py-10 text-center text-slate-400">{t('products.list.noMatch')}</TableCell>
              </TableRow>
            )}
            {products.map((product) => (
            <TableRow
              key={product.id}
              className="border-slate-700 hover:bg-slate-800/50 transition-colors group"
            >
              <TableCell className="text-slate-50 font-medium">
                <div className="flex items-center gap-3">
                  {product.image_url ? (
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-700">
                      <Image 
                        src={product.image_url} 
                        alt={product.name} 
                        fill 
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-lg border border-slate-700/50">
                      {getCategoryIcon(product.categories?.[0]?.name || product.category || '')}
                    </div>
                  )}
                  <div>
                    <span>{product.name}</span>
                    {product.is_deliverable === false && (
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] font-normal text-amber-400">
                        <TruckIcon className="h-3 w-3" />
                        {t('products.list.notDeliverable')}
                      </span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-slate-400">
                {product.categories?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {product.categories.map((c) => (
                      <span
                        key={c.id}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium border ${
                          c.is_active === false
                            ? 'bg-slate-700/30 text-slate-500 border-slate-600 line-through'
                            : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        }`}
                      >
                        <Tag className="w-3 h-3" />
                        {categoryLabel({ ...c, parent_id: categories.find((x) => x.id === c.id)?.parent_id ?? null }, categories)}
                      </span>
                    ))}
                  </div>
                ) : product.category ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Tag className="w-3 h-3" />
                    {product.category}
                  </span>
                ) : (
                  <span className="text-slate-500 text-sm">-</span>
                )}
              </TableCell>
              <TableCell className="text-slate-400">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${
                  (product.destination || 'CUISINE') === 'CUISINE' 
                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' 
                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                }`}>
                  {(product.destination || 'CUISINE') === 'CUISINE' ? t('products.destination.CUISINE') : t('products.destination.BAR')}
                </span>
              </TableCell>
              <TableCell className="text-slate-50 text-right font-bold">
                {format.money(product.price)}
              </TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${product.is_available
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-red-500/10 text-red-400'
                    }`}
                >
                  {product.is_available ? (
                    <>
                      <CheckCircle className="w-3 h-3" />
                      {t('products.list.available')}
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" />
                      {t('products.list.unavailable')}
                    </>
                  )}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-40 bg-slate-800 border-slate-700 text-slate-200"
                  >
                    <Link href={`/products/${product.id}`}>
                      <DropdownMenuItem className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 gap-2">
                        <Edit2 className="w-4 h-4 text-blue-400" />
                        <span>{t('common.edit')}</span>
                      </DropdownMenuItem>
                    </Link>
                    <DropdownMenuSeparator className="bg-slate-700" />
                    <DropdownMenuItem
                      onClick={() => handleDelete(product.id)}
                      disabled={deletingId === product.id}
                      className="cursor-pointer hover:bg-slate-700 focus:bg-slate-700 gap-2 text-red-400"
                    >
                      {deletingId === product.id ? (
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      <span>{t('common.delete')}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        </Table>
        <PageNav meta={meta} />
      </div>
    </div>
  );
}