'use client';

import { createRoom } from '@/app/actions/rooms';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { ImageUpload } from '@/components/image-upload';
import { ArrowLeft, BedDouble, Home, DollarSign, Hotel, Plus, Image as ImageIcon } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/client';

export default function NewRoomPage() {
  const router = useRouter();
  const { t } = useT();
  const [state, formAction, isPending] = useActionState(createRoom, {
    success: false,
    error: '',
  });

  const [image1, setImage1] = useState<string | null>(null);
  const [image2, setImage2] = useState<string | null>(null);

  useEffect(() => {
    if (state.success) {
      router.push('/rooms');
    }
  }, [state.success, router]);

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Background Decoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full relative">
        {/* Back Button */}
        <Link
          href="/rooms"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-400 mb-6 transition-all duration-300 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>{t('hotel.roomForm.back')}</span>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
            {t('hotel.roomForm.createTitle')}
          </h1>
          <p className="text-slate-400">{t('hotel.roomForm.createSubtitle')}</p>
        </div>

        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700/50 shadow-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 pointer-events-none" />

          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-slate-50 flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <BedDouble className="w-4 h-4 text-white" />
              </div>
              {t('hotel.roomForm.createCard')}
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-6">
            <form action={formAction} className="space-y-8">
              {/* Section Informations générales */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-slate-300 border-b border-slate-700 pb-2">
                  <Hotel className="w-4 h-4 text-blue-400" />
                  <h3 className="font-semibold">{t('hotel.roomForm.section')}</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Home className="w-4 h-4 text-blue-400" />
                      {t('hotel.roomForm.number')}
                    </label>
                    <Input
                      name="roomNumber"
                      type="text"
                      placeholder={t('hotel.roomForm.numberPlaceholder')}
                      className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300 group-hover:border-slate-500"
                      required
                    />
                    <p className="text-xs text-slate-500 mt-1">{t('hotel.roomForm.numberHint')}</p>
                  </div>

                  <div className="space-y-2 group">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <BedDouble className="w-4 h-4 text-purple-400" />
                      {t('hotel.roomForm.type')}
                    </label>
                    <select
                      name="roomType"
                      defaultValue="Standard"
                      className="w-full bg-slate-900/50 border border-slate-600 text-slate-50 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300 cursor-pointer hover:border-slate-500"
                    >
                      <option value="Standard">🏨 {t('hotel.roomTypes.Standard.label')}</option>
                      <option value="Double">🛏️ {t('hotel.roomTypes.Double.label')}</option>
                      <option value="Studio">✨ {t('hotel.roomTypes.Studio.label')}</option>
                      <option value="Suite">👑 {t('hotel.roomTypes.Suite.label')}</option>
                      <option value="Familiale">👨‍👩‍👧‍👦 {t('hotel.roomTypes.Familiale.label')}</option>
                      <option value="Autre">📦 {t('hotel.roomTypes.Autre.label')}</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2 group">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    {t('hotel.roomForm.price')}
                  </label>
                  <Input
                    name="price"
                    type="number"
                    min="0"
                    defaultValue="0"
                    step="1000"
                    placeholder={t('hotel.roomForm.pricePlaceholder')}
                    className="bg-slate-900/50 border-slate-600 text-slate-50 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all duration-300 group-hover:border-slate-500"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">{t('hotel.roomForm.priceHint')}</p>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-400" />
                    {t('hotel.roomForm.images')}
                  </label>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <input type="hidden" name="image1" value={image1 || ''} />
                      <ImageUpload value={image1} onChange={setImage1} disabled={isPending} />
                    </div>
                    <div className="flex-1">
                      <input type="hidden" name="image2" value={image2 || ''} />
                      <ImageUpload value={image2} onChange={setImage2} disabled={isPending} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Message d'erreur */}
              {state.error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                    {state.error}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-700">
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-2.5 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('hotel.roomForm.creating')}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      {t('hotel.roomForm.create')}
                    </div>
                  )}
                </Button>

                <Link href="/rooms" className="flex-1 sm:flex-none">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-300"
                  >
                    {t('common.cancel')}
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            {t('hotel.roomForm.createFooter')}
          </p>
        </div>
      </div>
    </div>
  );
}