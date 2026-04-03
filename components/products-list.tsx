'use client';

import { Product } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2, MoreVertical, CheckCircle, XCircle, Package, Tag } from 'lucide-react';
import Link from 'next/link';
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
import { useState } from 'react';

interface ProductsListProps {
  products: Product[];
  onProductDeleted?: () => void;
}

export function ProductsList({ products, onProductDeleted }: ProductsListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (productId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) return;

    setDeletingId(productId);
    const res = await deleteProduct(productId);
    setDeletingId(null);
    if (!res.success) {
      alert(res.error);
    } else {
      onProductDeleted?.();
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
    <div className="rounded-xl border border-slate-700/50 overflow-hidden bg-slate-800/30">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-700 hover:bg-transparent bg-slate-800/50">
            <TableHead className="text-slate-300 font-semibold">Nom</TableHead>
            <TableHead className="text-slate-300 font-semibold">Catégorie</TableHead>
            <TableHead className="text-slate-300 font-semibold text-right">Prix</TableHead>
            <TableHead className="text-slate-300 font-semibold">Disponibilité</TableHead>
            <TableHead className="text-slate-300 font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow
              key={product.id}
              className="border-slate-700 hover:bg-slate-800/50 transition-colors group"
            >
              <TableCell className="text-slate-50 font-medium">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-lg">
                    {getCategoryIcon(product.category || '')}
                  </div>
                  <span>{product.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-slate-400">
                {product.category ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Tag className="w-3 h-3" />
                    {product.category}
                  </span>
                ) : (
                  <span className="text-slate-500 text-sm">-</span>
                )}
              </TableCell>
              <TableCell className="text-slate-50 text-right font-bold">
                {product.price.toLocaleString()} FCFA
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
                      Disponible
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" />
                      Indisponible
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
                        <span>Modifier</span>
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
                      <span>Supprimer</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}