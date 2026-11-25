import React from 'react';
import { Calendar } from 'lucide-react';
import type { DateFilterType } from '../../utils/date';

interface DateRangeFilterProps {
  selectedFilter: DateFilterType;
  onChange: (filter: DateFilterType) => void;
  customFrom?: string;
  customTo?: string;
  onCustomChange?: (from: string, to: string) => void;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  selectedFilter,
  onChange,
  customFrom,
  customTo,
  onCustomChange,
}) => {
  const options: { id: DateFilterType; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'this_week', label: 'This Week' },
    { id: 'this_month', label: 'This Month' },
    { id: 'all', label: 'All Records' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5 shadow-xs">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              selectedFilter === opt.id
                ? 'bg-navy-800 text-white shadow-xs dark:bg-navy-700'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {selectedFilter === 'custom' && onCustomChange && (
        <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs shadow-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="date"
            value={customFrom || ''}
            onChange={(e) => onCustomChange(e.target.value, customTo || '')}
            className="bg-transparent border-0 text-slate-800 dark:text-slate-200 text-xs focus:outline-hidden"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={customTo || ''}
            onChange={(e) => onCustomChange(customFrom || '', e.target.value)}
            className="bg-transparent border-0 text-slate-800 dark:text-slate-200 text-xs focus:outline-hidden"
          />
        </div>
      )}
    </div>
  );
};
