import React from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.FC<{ className?: string }>;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  trend?: {
    text: string;
    positive?: boolean;
  };
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  trend,
}) => {
  const variantStyles = {
    default: {
      border: 'border-slate-200 dark:border-slate-700',
      iconBg: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    },
    primary: {
      border: 'border-navy-200 dark:border-navy-800',
      iconBg: 'bg-navy-100 text-navy-800 dark:bg-navy-900/60 dark:text-sky-300',
    },
    success: {
      border: 'border-emerald-200 dark:border-emerald-900',
      iconBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300',
    },
    warning: {
      border: 'border-amber-200 dark:border-amber-900',
      iconBg: 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300',
    },
    danger: {
      border: 'border-rose-200 dark:border-rose-900',
      iconBg: 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300',
    },
  }[variant];

  return (
    <div
      className={`bg-white dark:bg-slate-800 p-4 rounded-xl border ${variantStyles.border} shadow-xs flex flex-col justify-between`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {title}
        </span>
        <div className={`p-2 rounded-lg ${variantStyles.iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-3">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white num-cell text-left tracking-tight">
          {value}
        </h3>
        {subtitle && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      {trend && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center text-[10px]">
          <span
            className={`font-semibold ${
              trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {trend.text}
          </span>
        </div>
      )}
    </div>
  );
};
