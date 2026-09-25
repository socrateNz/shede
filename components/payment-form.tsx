'use client';

import { createPayment } from '@/app/actions/payments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { CreditCard, Wallet, Landmark, Banknote, Loader2, CheckCircle, AlertCircle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/client';

interface PaymentFormProps {
  orderId: string;
  amount: number;
  onSuccess: () => void;
}

const paymentMethodStyles = [
  { value: 'CASH', icon: Banknote, color: 'text-green-400', bg: 'bg-green-500/10' },
  { value: 'CARD', icon: CreditCard, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { value: 'CHEQUE', icon: Wallet, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { value: 'TRANSFER', icon: Landmark, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { value: 'MOBILE', icon: Smartphone, color: 'text-orange-400', bg: 'bg-orange-500/10' },
] as const;

export function PaymentForm({ orderId, amount, onSuccess }: PaymentFormProps) {
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const { t, format } = useT();
  const paymentMethods = paymentMethodStyles.map((method) => ({
    ...method,
    label: t(`common.paymentMethods.${method.value}`),
  }));
  const [paymentAmount, setPaymentAmount] = useState(amount.toString());
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await createPayment(
      orderId,
      parseFloat(paymentAmount),
      paymentMethod,
      reference || undefined
    );

    if (result.success) {
      toast.success(t('orders.payment.success'));
      onSuccess();
    } else {
      setError(result.error || t('orders.payment.failed'));
      toast.error(result.error || t('orders.payment.failed'));
      setLoading(false);
    }
  };

  const currentMethod = paymentMethods.find(m => m.value === paymentMethod) || paymentMethods[0];
  const MethodIcon = currentMethod.icon;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Méthode de paiement */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-blue-400" />
          {t('orders.payment.method')}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {paymentMethods.map((method) => {
            const Icon = method.icon;
            const isSelected = paymentMethod === method.value;
            return (
              <button
                key={method.value}
                type="button"
                onClick={() => setPaymentMethod(method.value)}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-all duration-200 cursor-pointer ${isSelected
                    ? `${method.bg} border-${method.value === 'CASH' ? 'green' : method.value === 'CARD' ? 'blue' : method.value === 'CHEQUE' ? 'purple' : method.value === 'MOBILE' ? 'orange' : 'amber'}-500/50`
                    : 'bg-slate-900/50 border-slate-600 hover:border-slate-500'
                  }`}
              >
                <Icon className={`w-4 h-4 ${method.color}`} />
                <span className={`text-sm font-medium ${isSelected ? method.color : 'text-slate-400'}`}>
                  {method.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Montant */}
      <div className="space-y-2 group">
        <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-400" />
          {t('orders.payment.amount')}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">FCFA</span>
          <Input
            type="number"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            step="100"
            min="0"
            className="bg-slate-900/50 border-slate-600 text-slate-50 pl-16 focus:border-emerald-500 focus:ring-emerald-500/20"
            required
          />
        </div>
        <p className="text-xs text-slate-500">{t('orders.payment.totalDue', { amount: format.money(amount) })}</p>
      </div>

      {/* Référence (pour les paiements non-espèces) */}
      {paymentMethod !== 'CASH' && (
        <div className="space-y-2 group">
          <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Landmark className="w-4 h-4 text-amber-400" />
            {t('orders.payment.reference')}
          </label>
          <Input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={t('orders.payment.referencePlaceholder')}
            className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20"
          />
          <p className="text-xs text-slate-500">
            {paymentMethod === 'CARD' && t('orders.payment.hintCard')}
            {paymentMethod === 'CHEQUE' && t('orders.payment.hintCheque')}
            {paymentMethod === 'TRANSFER' && t('orders.payment.hintTransfer')}
            {paymentMethod === 'MOBILE' && t('orders.payment.hintMobile')}
          </p>
        </div>
      )}

      {/* Résumé du paiement */}
      <div className="rounded-lg bg-slate-900/30 p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">{t('orders.payment.methodLabel')}</span>
          <span className="text-sm text-slate-300 flex items-center gap-1">
            <MethodIcon className="w-3.5 h-3.5" />
            {currentMethod.label}
          </span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-slate-700">
          <span className="text-sm font-medium text-slate-300">{t('orders.payment.toPay')}</span>
          <span className="text-xl font-bold text-white">
            {format.money(parseFloat(paymentAmount || '0'))}
          </span>
        </div>
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        </div>
      )}

      {/* Bouton de soumission */}
      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-2.5 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{t('orders.payment.processing')}</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>{t('orders.payment.submit')}</span>
          </div>
        )}
      </Button>
    </form>
  );
}