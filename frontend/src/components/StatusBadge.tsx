import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const norm = status?.toUpperCase() || 'UNKNOWN';

  let colorClasses = 'bg-slate-800 text-slate-300 border-slate-700';

  // Organ & Allocation status styles
  if (['AVAILABLE', 'COMPLETED', 'VERIFIED', 'CONSENTED', 'ELIGIBLE', 'ACCEPTED', 'EXACT_MATCH'].includes(norm)) {
    colorClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  } else if (['OFFERED', 'MATCHED', 'IN_PROGRESS', 'PENDING_REVIEW', 'COMPATIBLE_DONOR'].includes(norm)) {
    colorClasses = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
  } else if (['WAITING'].includes(norm)) {
    colorClasses = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
  } else if (['DECLINED', 'EXPIRED', 'FAILED', 'REJECTED', 'INCOMPATIBLE', 'DISCARDED'].includes(norm)) {
    colorClasses = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  } else if (['PENDING', 'WITHDRAWN', 'INACTIVE', 'SUSPENDED', 'CANCELLED'].includes(norm)) {
    colorClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  }

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-3.5 py-1.5 font-semibold',
  }[size];

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${sizeClasses} ${colorClasses}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
      {norm.replace(/_/g, ' ')}
    </span>
  );
};
