import React from 'react';
import { AgentReadinessChecklist } from './dashboard/AgentReadinessChecklist';

interface GBPAuditChecklistProps {
  profile: any;
  t: (es: string, en: string) => string;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  gmbConnected?: boolean;
  gmbReviews?: any[];
  onNavigateTab?: (tab: string, subRow?: number) => void;
  onOpenGmbModal?: () => void;
}

export function GBPAuditChecklist({ 
  profile, 
  t, 
  showToast,
  gmbConnected = false,
  gmbReviews = [],
  onNavigateTab,
  onOpenGmbModal
}: GBPAuditChecklistProps) {
  return (
    <div className="max-w-4xl mx-auto py-2">
      <AgentReadinessChecklist
        profile={profile}
        gmbConnected={gmbConnected || profile?.gbpConnectionStatus === 'CONNECTED' || profile?.gmbConnected}
        gmbReviews={gmbReviews}
        onNavigateTab={onNavigateTab}
        onOpenGmbModal={onOpenGmbModal}
        t={t}
        showToast={showToast}
      />
    </div>
  );
}
