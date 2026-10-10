import React, { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScrollToTopButtonProps {
  threshold?: number;
}

export function ScrollToTopButton({ threshold = 300 }: ScrollToTopButtonProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    // Dynamically create or find sentinel
    let sentinel = document.getElementById('scroll-sentinel');
    let mainSentinel = document.getElementById('main-scroll-sentinel');
    
    if (!sentinel) {
      sentinel = document.createElement('div');
      sentinel.id = 'scroll-sentinel';
      sentinel.style.position = 'absolute';
      sentinel.style.top = '0px';
      sentinel.style.left = '0px';
      sentinel.style.width = '1px';
      sentinel.style.height = '1px';
      sentinel.style.pointerEvents = 'none';
      sentinel.style.opacity = '0';
      document.body.appendChild(sentinel);
    }

    const mainEl = document.querySelector('main');
    if (mainEl && !mainSentinel) {
      mainSentinel = document.createElement('div');
      mainSentinel.id = 'main-scroll-sentinel';
      mainSentinel.style.position = 'absolute';
      mainSentinel.style.top = '0px';
      mainSentinel.style.left = '0px';
      mainSentinel.style.width = '1px';
      mainSentinel.style.height = '1px';
      mainSentinel.style.pointerEvents = 'none';
      mainSentinel.style.opacity = '0';
      if (mainEl.firstChild) {
        mainEl.insertBefore(mainSentinel, mainEl.firstChild);
      } else {
        mainEl.appendChild(mainSentinel);
      }
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        // If intersecting, we are at the top (under the threshold), so hide button
        // If not intersecting, we have scrolled down beyond the threshold, so show button
        if (entry.isIntersecting) {
          setIsVisible(false);
        } else {
          setIsVisible(true);
        }
      });
    }, {
      root: null, // relative to viewport
      rootMargin: `-${threshold}px 0px 0px 0px`, // triggers after scrolling past threshold px
      threshold: 0
    });

    if (sentinel) observer.observe(sentinel);
    if (mainSentinel) observer.observe(mainSentinel);

    return () => {
      observer.disconnect();
      if (sentinel && sentinel.parentNode === document.body) {
        document.body.removeChild(sentinel);
      }
      if (mainSentinel && mainEl && mainSentinel.parentNode === mainEl) {
        mainEl.removeChild(mainSentinel);
      }
    };
  }, [threshold]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={scrollToTop}
          aria-label="Volver arriba"
          className="fixed bottom-[calc(136px+env(safe-area-inset-bottom))] right-4 md:bottom-8 md:right-8 z-40 flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-xl shadow-slate-900/10 hover:bg-white dark:hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all group cursor-pointer"
        >
          <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 group-hover:bg-indigo-500 transition-colors">
            <ChevronUp size={16} className="stroke-[3]" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider pr-1 hidden sm:inline text-indigo-600 dark:text-indigo-400">
            Arriba
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
};
