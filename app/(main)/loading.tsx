import { Skeleton } from '@/components/ui/skeleton';

export default function MainLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8 animate-pulse">
      <div className="max-w-7xl mx-auto">
        {/* Header skeleton */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Skeleton className="h-9 w-56 bg-slate-700/60 mb-2 rounded-lg" />
            <Skeleton className="h-4 w-40 bg-slate-700/40 rounded" />
          </div>
          <Skeleton className="h-8 w-32 bg-slate-700/40 rounded-lg" />
        </div>

        {/* KPI cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5"
            >
              <div className="flex justify-between mb-3">
                <Skeleton className="h-4 w-24 bg-slate-700/40 rounded" />
                <Skeleton className="h-8 w-8 bg-slate-700/40 rounded-lg" />
              </div>
              <Skeleton className="h-7 w-20 bg-slate-700/60 rounded" />
            </div>
          ))}
        </div>

        {/* Main content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 bg-slate-800/50 rounded-xl" />
            <Skeleton className="h-48 bg-slate-800/50 rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-64 bg-slate-800/50 rounded-xl" />
            <Skeleton className="h-48 bg-slate-800/50 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
