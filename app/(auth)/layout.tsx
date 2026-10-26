export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Palette Tavola sombre (noir profond, ivoire, champagne) pour toutes les pages d'authentification
  return <div className="tavola-sombre bg-slate-950 text-slate-100">{children}</div>;
}
