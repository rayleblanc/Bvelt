import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'rect' }) => {
  const baseClass = "animate-pulse bg-slate-200 dark:bg-slate-800";
  
  let variantClass = "rounded-xl";
  if (variant === 'text') variantClass = "rounded-md h-4 w-full";
  if (variant === 'circle') variantClass = "rounded-full";

  return <div className={`${baseClass} ${variantClass} ${className}`} id="skeleton-element" />;
};

export const CardSkeleton = () => (
  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl space-y-4 shadow-sm">
    <div className="flex items-center justify-between">
      <Skeleton className="w-24 h-5" variant="text" />
      <Skeleton className="w-8 h-8" variant="circle" />
    </div>
    <div className="space-y-2">
      <Skeleton className="w-full h-4" variant="text" />
      <Skeleton className="w-3/4 h-4" variant="text" />
    </div>
    <div className="pt-2">
      <Skeleton className="w-full h-10" />
    </div>
  </div>
);

export const ListSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
        <Skeleton className="w-10 h-10" variant="circle" />
        <div className="flex-1 space-y-2">
          <Skeleton className="w-1/3 h-3" variant="text" />
          <Skeleton className="w-2/3 h-4" variant="text" />
        </div>
      </div>
    ))}
  </div>
);
