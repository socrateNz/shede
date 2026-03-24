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

interface ProductsListProps {
  products: Product[];
}

export function ProductsList({ products }: ProductsListProps) {
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
            <TableCell className="text-right">
              <Link href={`/products/${product.id}`}>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-200">
                  <Edit2 className="w-4 h-4" />
                </Button>
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
