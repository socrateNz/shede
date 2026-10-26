import { cn } from '@/lib/utils';

/**
 * Logo Tavola — by Tacynt.
 * - `variant` : `symbol` (monogramme seul, pour les espaces étroits), `horizontal` (monogramme +
 *   TAVOLA, barre latérale, en-têtes), `full` (monogramme au-dessus, TAVOLA, — BY TACYNT —).
 * - `tone` : fond sur lequel le logo est posé. `dark` = monogramme champagne, texte ivoire ;
 *   `light` = monogramme et texte noir profond ; `auto` = suit le thème du back-office
 *   (variante `dark:`), champagne en sombre, noir en clair.
 * Le nom est en police de marque (Cormorant Garamond) : net à toutes les tailles.
 */
type Variant = 'symbol' | 'horizontal' | 'full';
type Tone = 'dark' | 'light' | 'auto';

const SYMBOLE_OR = '/brand/tavola-symbole-or.png';
const SYMBOLE_NOIR = '/brand/tavola-symbole-noir.png';
// Proportions du monogramme (largeur / hauteur), d'après le fichier source
const RATIO = 600 / 445;

function Monogramme({ tone, height, className }: { tone: Tone; height: number; className?: string }) {
  const style = { height, width: Math.round(height * RATIO) };
  if (tone === 'auto') {
    return (
      <span className={cn('relative inline-block shrink-0', className)} style={style} aria-hidden="true">
        <img src={SYMBOLE_NOIR} alt="" className="absolute inset-0 h-full w-full dark:hidden" />
        <img src={SYMBOLE_OR} alt="" className="absolute inset-0 hidden h-full w-full dark:block" />
      </span>
    );
  }
  return <img src={tone === 'dark' ? SYMBOLE_OR : SYMBOLE_NOIR} alt="" aria-hidden="true" className={cn('shrink-0', className)} style={style} />;
}

export function TavolaLogo({
  variant = 'horizontal',
  tone = 'auto',
  size = 32,
  withSignature = true,
  className,
}: {
  variant?: Variant;
  tone?: Tone;
  /** Hauteur du monogramme en pixels. */
  size?: number;
  /** Affiche « BY TACYNT » (versions horizontale et complète). */
  withSignature?: boolean;
  className?: string;
}) {
  const texte = tone === 'dark' ? 'text-[#f4f1ea]' : tone === 'light' ? 'text-[#0b0b0b]' : 'text-slate-50';
  const signature = tone === 'light' ? 'text-[#8a6b36]' : tone === 'dark' ? 'text-[#c6a56b]' : 'text-blue-400';

  if (variant === 'symbol') {
    return (
      <span className={cn('inline-flex', className)} role="img" aria-label="Tavola">
        <Monogramme tone={tone} height={size} />
      </span>
    );
  }

  if (variant === 'full') {
    return (
      <div className={cn('inline-flex flex-col items-center text-center', className)} role="img" aria-label="Tavola by Tacynt">
        <Monogramme tone={tone} height={size} />
        <span
          className={cn('font-brand font-semibold leading-none tracking-[0.28em]', texte)}
          style={{ fontSize: size * 0.62, marginTop: size * 0.28, marginRight: '-0.28em' }}
        >
          TAVOLA
        </span>
        {withSignature && (
          <span className={cn('mt-2 flex items-center gap-3 text-[0.62rem] font-medium tracking-[0.32em]', signature)}>
            <span className="h-px w-6 bg-current opacity-60" />
            BY TACYNT
            <span className="h-px w-6 bg-current opacity-60" />
          </span>
        )}
      </div>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)} role="img" aria-label="Tavola by Tacynt">
      <Monogramme tone={tone} height={size} />
      <span className="flex flex-col leading-none">
        <span className={cn('font-brand font-semibold tracking-[0.2em]', texte)} style={{ fontSize: size * 0.66 }}>
          TAVOLA
        </span>
        {withSignature && (
          <span className={cn('mt-1 text-[0.55rem] font-medium tracking-[0.3em]', signature)}>BY TACYNT</span>
        )}
      </span>
    </span>
  );
}
