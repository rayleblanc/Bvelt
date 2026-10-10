import React from 'react';
import { getEvidenceBadge, getEvidenceBackedBadge, EvidenceStatus, EVIDENCE_BACKED_THRESHOLD } from '../lib/bveltEvidence';

export interface EvidenceBadgeProps {
  status?: EvidenceStatus | string;
  count?: number;
  threshold?: number;
  t?: (es: string, en: string) => string;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
  showIcon?: boolean;
}

export const EvidenceBadge: React.FC<EvidenceBadgeProps> = ({
  status = 'VERIFIED',
  count,
  threshold = EVIDENCE_BACKED_THRESHOLD,
  t,
  className = '',
  size = 'xs',
  showIcon = true
}) => {
  const badge = typeof count === 'number'
    ? getEvidenceBackedBadge(count, threshold, t)
    : getEvidenceBadge(status, t);

  const sizeClasses = size === 'xs' 
    ? 'text-[9px] px-2 py-0.5' 
    : size === 'sm' 
    ? 'text-[10px] px-2.5 py-1' 
    : 'text-xs px-3 py-1.5';

  return (
    <span
      title={badge.description}
      className={`inline-flex items-center gap-1 rounded-full border uppercase tracking-wider ${sizeClasses} ${badge.colorClass} ${className}`}
    >
      {showIcon && <span>{badge.icon}</span>}
      <span>{badge.label}</span>
    </span>
  );
};

