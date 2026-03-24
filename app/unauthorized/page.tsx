import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="text-6xl font-bold text-red-400">403</div>
          <h1 className="text-2xl font-bold text-slate-50">Access Denied</h1>
          <p className="text-slate-400">You don't have permission to access this resource.</p>
          <Link href="/dashboard">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              Back to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
