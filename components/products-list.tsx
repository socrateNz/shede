'use client';

import { Product } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { deleteProduct } from '@/app/actions/products';
import { useState } from 'react';

interface ProductsListProps {
  products: Product[];
}

export function ProductsList({ products }: ProductsListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    setDeletingId(productId);
    const res = await deleteProduct(productId);
    setDeletingId(null);
    if (!res.success) alert(res.error);
    else window.location.reload();
  };

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-slate-700 hover:bg-slate-800">
          <TableHead className="text-slate-300">Name</TableHead>
          <TableHead className="text-slate-300">Category</TableHead>
          <TableHead className="text-slate-300 text-right">Price</TableHead>
          <TableHead className="text-slate-300">Status</TableHead>
          <TableHead className="text-slate-300 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id} className="border-slate-700 hover:bg-slate-700/50">
            <TableCell className="text-slate-50 font-medium">{product.name}</TableCell>
            <TableCell className="text-slate-400">{product.category || '-'}</TableCell>
            <TableCell className="text-slate-50 text-right">${product.price.toFixed(2)}</TableCell>
            <TableCell>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  product.is_available
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-red-500/10 text-red-400'
                }`}
              >
                {product.is_available ? 'Available' : 'Unavailable'}
              </span>
            </TableCell>
            <TableCell className="text-right space-x-2">
              <Link href={`/products/${product.id}`}>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-200">
                  <Edit2 className="w-4 h-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(product.id)}
                disabled={deletingId === product.id}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
