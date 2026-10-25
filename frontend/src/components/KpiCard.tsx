import React from 'react';

interface KpiCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: string;
  color?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'purple' | 'blue';
  onClick?: () => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'cyan',
  onClick,
}) => {
  const accentColors = {
    cyan: 'from-cyan-500/20 to-blue-500/5 text-cyan-400 border-cyan-500/20 hover:border-cyan-500/40',
    emerald: 'from-emerald-500/20 to-teal-500/5 text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40',
    amber: 'from-amber-500/20 to-orange-500/5 text-amber-400 border-amber-500/20 hover:border-amber-500/40',
    rose: 'from-rose-500/20 to-pink-500/5 text-rose-400 border-rose-500/20 hover:border-rose-500/40',
    purple: 'from-purple-500/20 to-indigo-500/5 text-purple-400 border-purple-500/20 hover:border-purple-500/40',
    blue: 'from-blue-500/20 to-cyan-500/5 text-blue-400 border-blue-500/20 hover:border-blue-500/40',
  }[color];

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl p-5 border bg-gradient-to-br bg-slate-900/60 backdrop-blur-md transition-all duration-300 ${accentColors} ${
        onClick ? 'cursor-pointer hover:-translate-y-1' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">{title}</p>
        <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/50 shadow-inner">
          {icon}
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold font-display tracking-tight text-white">{value}</span>
        {trend && <span className="text-xs font-medium text-slate-400">{trend}</span>}
      </div>
      {subtitle && <p className="mt-1 text-xs text-slate-400 line-clamp-1">{subtitle}</p>}
    </div>
  );
};
