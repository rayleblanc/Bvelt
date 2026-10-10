import React, { useState } from 'react';

export const AppIcon: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => {
  const [srcIndex, setSrcIndex] = useState(0);
  const iconSources = ['/bvelt-icon-192.png', '/favicon.png', '/bvelt-icon-512.png'];

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden ${className}`}>
      {srcIndex < iconSources.length ? (
        <img 
          src={iconSources[srcIndex]} 
          alt="Bvelt Logo" 
          className="w-full h-full object-contain rounded-lg"
          referrerPolicy="no-referrer"
          onError={() => setSrcIndex(prev => prev + 1)}
        />
      ) : (
        <div className="w-full h-full rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
          B
        </div>
      )}
    </div>
  );
};
