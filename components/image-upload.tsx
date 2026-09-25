'use client';

import { useT } from '@/lib/i18n/client';

import { useState } from 'react';
import { Loader2, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

export function ImageUpload({ value, onChange, disabled }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { t } = useT();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('image')) {
      toast.error(t('products.upload.invalidImage'));
      return;
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      toast.error(t('products.upload.notConfigured'));
      console.error('Missing Cloudinary env variables.');
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(t('products.upload.uploadError'));
      }

      const data = await response.json();
      onChange(data.secure_url);
      toast.success(t('products.upload.uploaded'));
    } catch (error) {
      console.error(error);
      toast.error(t('products.upload.failed'));
    } finally {
      setIsUploading(false);
      // Réinitialiser l'input
      e.target.value = '';
    }
  };

  const handleRemove = () => {
    onChange(null);
  };

  return (
    <div className="space-y-4 w-full">
      {value ? (
        <div className="relative w-40 h-40 rounded-xl overflow-hidden border-2 border-slate-700 group">
          <Image
            src={value}
            alt={t('products.upload.alt')}
            fill
            className="object-cover"
          />
          {!disabled && (
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="rounded-full"
                onClick={handleRemove}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <label className={`
          flex flex-col items-center justify-center w-full h-40 
          border-2 border-dashed rounded-xl cursor-pointer 
          transition-all duration-300
          ${disabled ? 'opacity-50 cursor-not-allowed border-slate-700 bg-slate-800/20' : 'border-slate-600 bg-slate-800/50 hover:bg-slate-800 hover:border-blue-500/50'}
        `}>
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {isUploading ? (
              <>
                <Loader2 className="w-8 h-8 mb-3 text-blue-500 animate-spin" />
                <p className="mb-2 text-sm text-slate-400">{t('products.upload.uploading')}</p>
              </>
            ) : (
              <>
                <div className="w-10 h-10 mb-3 rounded-full bg-slate-900/50 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-slate-400" />
                </div>
                <p className="mb-2 text-sm text-slate-300">
                  <span className="font-semibold text-blue-400">{t('products.upload.click')}</span> {t('products.upload.toUpload')}
                </p>
                <p className="text-xs text-slate-500">{t('products.upload.formats')}</p>
              </>
            )}
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleUpload}
            disabled={disabled || isUploading}
          />
        </label>
      )}
    </div>
  );
}
