'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

const logos = [
  { name: 'HOTEL.CO' },
  { name: 'RESTAURANT.ONE' },
  { name: 'LUXERY.INN' },
  { name: 'DAILY.EATS' },
  { name: 'SMART.POS' },
  { name: 'BOUTIQUE.HOTEL' },
  { name: 'FINE.DINING' },
  { name: 'QUICK.EATS' },
];

export default function LogoCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [itemsPerView, setItemsPerView] = useState(5);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) setItemsPerView(2);
      else if (window.innerWidth < 768) setItemsPerView(3);
      else if (window.innerWidth < 1024) setItemsPerView(4);
      else setItemsPerView(5);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % logos.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isPlaying, itemsPerView]);

  const nextSlide = () =>
    setCurrentIndex((prev) => (prev + itemsPerView >= logos.length ? 0 : prev + 1));

  const prevSlide = () =>
    setCurrentIndex((prev) =>
      prev === 0 ? Math.max(0, logos.length - itemsPerView) : prev - 1
    );

  return (
    <div className="mx-auto max-w-7xl px-6 mt-24">
      <p className="text-center text-sm font-semibold text-slate-400 uppercase tracking-[0.2em] mb-10">
        Ils nous font confiance
      </p>

      <div className="relative group">
        {/* Carousel Container */}
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${currentIndex * (100 / itemsPerView)}%)` }}
          >
            {logos.map((logo, idx) => (
              <div
                key={idx}
                className="flex-shrink-0 px-4"
                style={{ width: `${100 / itemsPerView}%` }}
              >
                <div className="flex justify-center items-center">
                  <span className="text-xl md:text-2xl font-black tracking-tighter text-slate-900 opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300 cursor-pointer">
                    {logo.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Buttons */}
        <button
          onClick={prevSlide}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 lg:-translate-x-6 bg-white/80 backdrop-blur-sm hover:bg-white rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300"
          aria-label="Précédent"
        >
          <ChevronLeft className="w-5 h-5 text-slate-700" />
        </button>

        <button
          onClick={nextSlide}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 lg:translate-x-6 bg-white/80 backdrop-blur-sm hover:bg-white rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300"
          aria-label="Suivant"
        >
          <ChevronRight className="w-5 h-5 text-slate-700" />
        </button>

        {/* Play/Pause Button */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm hover:bg-white rounded-full p-2 shadow-md transition-all duration-300"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 text-slate-700" />
          ) : (
            <Play className="w-4 h-4 text-slate-700" />
          )}
        </button>
      </div>

      {/* Dots Indicator */}
      <div className="flex justify-center gap-2 mt-12">
        {Array.from({ length: Math.ceil(logos.length / itemsPerView) }).map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx * itemsPerView)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              Math.floor(currentIndex / itemsPerView) === idx
                ? 'w-8 bg-purple-600'
                : 'w-1.5 bg-slate-300 hover:bg-slate-400'
            }`}
            aria-label={`Aller au slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
