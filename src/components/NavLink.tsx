import React from 'react';

export interface NavLinkProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
  badge?: string | React.ReactNode;
  badgeColor?: string;
}

export const NavLink: React.FC<NavLinkProps> = ({
  icon,
  label,
  active,
  onClick,
  color = 'text-indigo-500',
  badge,
  badgeColor = 'bg-indigo-500/10 text-indigo-500 dark:bg-indigo-400/20 dark:text-indigo-300'
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer text-left min-h-[44px] ${
        active
          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-slate-900 dark:text-white border border-indigo-200/60 dark:border-indigo-800/40 shadow-sm'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`shrink-0 transition-colors ${active ? color : 'text-slate-400 dark:text-slate-500'}`}>
          {icon}
        </span>
        <span className="truncate tracking-tight">{label}</span>
      </div>
      {badge && (
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeColor}`}>
          {badge}
        </span>
      )}
    </button>
  );
};
