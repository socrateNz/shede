import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function HomePage() {
  const session = await getSession();

  // if (session) {
  //   redirect(session.role === 'SUPER_ADMIN' ? '/structures' : '/dashboard');
  // }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-14">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <span className="font-bold text-blue-300">S</span>
            </div>
            <div>
              <p className="text-sm text-slate-300">Shede</p>
              <h1 className="text-xl font-semibold">Assistant caisse restaurant</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/login"
              className="px-4 py-2 rounded-md bg-slate-800 border border-slate-700 text-sm hover:bg-slate-750"
            >
              Se connecter
            </a>
            <a
              href="/register"
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-sm font-medium"
            >
              Créer un compte
            </a>
          </div>
        </header>

        <section className="mt-10 grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-sm text-blue-300">Point de vente moderne</p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight">
              Gérez produits et commandes, avec des accompagnements finement contrôlés.
            </h2>
            <p className="mt-4 text-slate-300 leading-relaxed">
              Lors de la commande, vous choisissez les accompagnements et vous décidez si leur prix est
              compté ou non. Le serveur enregistre tout et met à jour les totaux.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="/login"
                className="inline-flex items-center justify-center px-5 py-3 rounded-md bg-blue-600 hover:bg-blue-700 text-sm font-medium"
              >
                Commencer maintenant
              </a>
              <a
                href="/orders"
                className="inline-flex items-center justify-center px-5 py-3 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-750 text-sm"
              >
                Voir les commandes
              </a>
            </div>

            <p className="mt-5 text-xs text-slate-400">
              Astuce : l’accès aux écrans de gestion nécessite une authentification.
            </p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-6">
            <h3 className="text-lg font-semibold">En bref</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-200">
              <li className="flex gap-3">
                <span className="mt-1 h-5 w-5 rounded bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  ✓
                </span>
                <span>Produits, disponibilité, et tarification.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-5 w-5 rounded bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  ✓
                </span>
                <span>Accompagnements distincts, réutilisables entre produits.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-5 w-5 rounded bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  ✓
                </span>
                <span>Toggle “prix compté” à l’instant de la commande.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-5 w-5 rounded bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  ✓
                </span>
                <span>Totaux recalculés côté serveur avec snapshots.</span>
              </li>
            </ul>
          </div>
        </section>

        <footer className="mt-12 border-t border-slate-800 pt-8 text-xs text-slate-400">
          <p>Shede. Construit pour les besoins de la caisse restaurant.</p>
        </footer>
      </div>
    </main>
  );
}
