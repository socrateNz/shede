'use client';

import { createPayment } from '@/app/actions/payments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

interface PaymentFormProps {
  orderId: string;
  amount: number;
  onSuccess: () => void;
}

export function PaymentForm({ orderId, amount, onSuccess }: PaymentFormProps) {
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentAmount, setPaymentAmount] = useState(amount.toFixed(2));
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
      onSuccess();
    } else {
      setError(result.error || 'Payment failed');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200">Payment Method *</label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 text-slate-50 rounded-md px-3 py-2"
        >
          <option value="CASH">Cash</option>
          <option value="CARD">Card</option>
          <option value="CHEQUE">Cheque</option>
          <option value="TRANSFER">Bank Transfer</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200">Amount *</label>
        <Input
          type="number"
          value={paymentAmount}
          onChange={(e) => setPaymentAmount(e.target.value)}
          step="0.01"
          className="bg-slate-700 border-slate-600 text-slate-50"
          required
        />
      </div>

      {paymentMethod !== 'CASH' && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-200">Reference</label>
          <Input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. Transaction ID, Cheque Number"
            className="bg-slate-700 border-slate-600 text-slate-50 placeholder:text-slate-500"
          />
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 hover:bg-green-700 text-white"
      >
        {loading ? 'Processing...' : 'Complete Payment'}
      </Button>
    </form>
  );
}
