import { getProducts } from '@/app/actions/products';
import { requireRole } from '@/app/actions/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Package,
  Plus,
  CheckCircle,
  XCircle,
  LayoutDashboard,
  ShieldCheck,
  Tag,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { ProductsList } from '@/components/products-list';
import { redirect } from 'next/navigation';

async function getProductsStats(products: any[]) {
  const total = products.length;
  const available = products.filter(p => p.is_available).length;
  const unavailable = products.filter(p => !p.is_available).length;
  const categories = new Set(products.map(p => p.category).filter(Boolean)).size;

  return { total, available, unavailable, categories };
}

export default async function ProductsPage() {
  const session = await requireRole('ADMIN', 'SUPER_ADMIN');
  const products = await getProducts();
  const stats = await getProductsStats(products);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif (Blur effects) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 mb-4 backdrop-blur-sm">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-400 font-medium lowercase tracking-wide">
                Accès {session.role === 'ADMIN' ? 'Administrateur' : 'Super Admin'}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
              Gestion des Produits
            </h1>
            <p className="text-slate-400">Gérez votre inventaire, les prix et la disponibilité en temps réel</p>
          </div>

          <Link href="/products/new">
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all duration-300 transform hover:scale-105 border-none">
              <Plus className="w-4 h-4 mr-2" />
              Nouveau Produit
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total */}
          <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800/60 transition-all group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400 mb-1 uppercase tracking-wider">Total Produits</p>
                <h3 className="text-3xl font-bold text-white tracking-tight">{stats.total}</h3>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl group-hover:scale-110 transition-transform">
                <Package className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          {/* Disponibles */}
          <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800/60 transition-all group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400 mb-1 uppercase tracking-wider">Disponibles</p>
                <h3 className="text-3xl font-bold text-green-400 tracking-tight">{stats.available}</h3>
              </div>
              <div className="p-3 bg-green-500/10 rounded-xl group-hover:scale-110 transition-transform">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>

          {/* Indisponibles */}
          <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800/60 transition-all group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400 mb-1 uppercase tracking-wider">Indisponibles</p>
                <h3 className="text-3xl font-bold text-red-400 tracking-tight">{stats.unavailable}</h3>
              </div>
              <div className="p-3 bg-red-500/10 rounded-xl group-hover:scale-110 transition-transform">
                <XCircle className="w-6 h-6 text-red-400" />
              </div>
            </div>
          </div>

          {/* Catégories */}
          <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800/60 transition-all group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400 mb-1 uppercase tracking-wider">Catégories</p>
                <h3 className="text-3xl font-bold text-yellow-400 tracking-tight">{stats.categories}</h3>
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-xl group-hover:scale-110 transition-transform">
                <Tag className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <Card className="bg-slate-800/40 backdrop-blur-md border-slate-700/50 shadow-2xl overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />
          <CardHeader className="border-b border-slate-700/50 bg-slate-800/40 px-6 py-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-50 flex items-center gap-3 text-xl">
                <LayoutDashboard className="w-5 h-5 text-indigo-400" />
                Liste des Produits
              </CardTitle>
              <div className="text-xs text-slate-500 font-mono italic">
                Dernière mise à jour : {new Date().toLocaleTimeString()}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {products.length === 0 ? (
              <div className="text-center py-24 text-slate-400 relative">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-700/30 flex items-center justify-center border border-slate-700/50">
                  <Package className="w-12 h-12 opacity-20" />
                </div>
                <h3 className="text-xl font-semibold text-slate-200 mb-2">Aucun produit trouvé</h3>
                <p className="text-sm max-w-xs mx-auto mb-8 text-slate-500">
                  Vous n'avez pas encore ajouté de produits à votre catalogue.
                </p>
                <Link href="/products/new">
                  <Button variant="outline" className="border-slate-700 text-blue-400 hover:bg-slate-800 hover:border-blue-500/50 transition-all px-8 rounded-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter votre premier produit
                  </Button>
                </Link>
              </div>
            ) : (
              <ProductsList products={products} />
            )}
          </CardContent>
        </Card>

        {/* Footer info */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-medium">
            Shede SaaS v2.0 - Gestion d'Inventaire
          </p>
        </div>
      </div>
    </div>
  );
}