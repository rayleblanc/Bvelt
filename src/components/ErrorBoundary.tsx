import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import * as Sentry from '@sentry/react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    const isChunkError = 
      error?.message?.includes('dynamically imported module') ||
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('error loading dynamically imported module') ||
      error?.message?.includes('Loading chunk') ||
      error?.name === 'ChunkLoadError';

    if (isChunkError && typeof window !== 'undefined') {
      const lastReload = Number(sessionStorage.getItem('bvelt_eb_chunk_reload') || 0);
      const now = Date.now();
      if (now - lastReload > 8000) {
        sessionStorage.setItem('bvelt_eb_chunk_reload', String(now));
        console.warn('[ErrorBoundary] Chunk loading error caught. Auto-reloading to fetch updated build...');
        window.location.reload();
      }
    }

    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    Sentry.captureException(error, { extra: errorInfo as any });
  }

  public render() {
    if (this.state.hasError) {
      const isChunkError = 
        this.state.error?.message?.includes('dynamically imported module') ||
        this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
        this.state.error?.message?.includes('error loading dynamically imported module') ||
        this.state.error?.message?.includes('Loading chunk') ||
        this.state.error?.name === 'ChunkLoadError';

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center transition-colors">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl max-w-md shadow-2xl">
            <div className={`w-16 h-16 ${isChunkError ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'} rounded-full flex items-center justify-center mx-auto mb-4`}>
              {isChunkError ? <RefreshCw size={30} className="animate-spin" /> : <AlertTriangle size={32} />}
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white mb-2">
              {isChunkError ? 'Nueva Versión Disponible' : 'Algo salió mal'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              {isChunkError 
                ? 'Bvelt se ha actualizado con mejoras recientes. Haz clic para cargar la última versión de inmediato.'
                : 'Encontramos un error inesperado. Nuestro equipo ha sido notificado. Por favor, recarga la aplicación.'}
            </p>
            
            <button 
              onClick={() => {
                sessionStorage.removeItem('bvelt_eb_chunk_reload');
                sessionStorage.removeItem('bvelt_preload_reload');
                sessionStorage.removeItem('bvelt_chunk_unhandled_reload');
                window.location.reload();
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={18} />
              {isChunkError ? 'Actualizar Ahora' : 'Recargar Aplicación'}
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
