import React, { useState, useEffect, useRef } from 'react';
import { Search, Store, MapPin, Check } from 'lucide-react';
import { db } from '../../db/database';
import type { Retailer, Beat } from '../../types';

interface RetailerAutocompleteProps {
  value?: number;
  onChange: (retailerId: number, retailer: Retailer) => void;
  error?: string;
  autoFocus?: boolean;
}

export const RetailerAutocomplete: React.FC<RetailerAutocompleteProps> = ({
  value,
  onChange,
  error,
  autoFocus = false,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [beats, setBeats] = useState<Map<number, string>>(new Map());
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const allRetailers = await db.retailers.toArray();
      const allBeats = await db.beats.toArray();
      const beatMap = new Map<number, string>();
      allBeats.forEach((b) => beatMap.set(b.id!, b.name));

      setRetailers(allRetailers);
      setBeats(beatMap);

      if (value) {
        const found = allRetailers.find((r) => r.id === value);
        if (found) {
          setSelectedRetailer(found);
          setQuery(found.retailerName);
        }
      }
    };
    loadData();
  }, [value]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredRetailers = retailers.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      r.retailerName.toLowerCase().includes(q) ||
      r.contactNumber.includes(q) ||
      (beats.get(r.beatId) || '').toLowerCase().includes(q)
    );
  });

  const handleSelect = (retailer: Retailer) => {
    setSelectedRetailer(retailer);
    setQuery(retailer.retailerName);
    setIsOpen(false);
    onChange(retailer.id!, retailer);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev < filteredRetailers.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : filteredRetailers.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredRetailers[highlightIndex]) {
        handleSelect(filteredRetailers[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
        Retailer Name <span className="text-rose-500">*</span>
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Type first 2-3 letters of retailer..."
          className={`w-full pl-9 pr-9 py-2 text-xs rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition focus:outline-hidden focus:ring-2 ${
            error
              ? 'border-rose-400 focus:ring-rose-200'
              : 'border-slate-300 dark:border-slate-600 focus:border-navy-600 focus:ring-navy-100 dark:focus:ring-navy-950'
          }`}
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />

        {selectedRetailer && (
          <Check className="w-4 h-4 text-emerald-600 absolute right-2.5 top-2.5 pointer-events-none" />
        )}
      </div>

      {error && <p className="text-[11px] text-rose-500 mt-1">{error}</p>}

      {/* Autocomplete Dropdown List */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50 divide-y divide-slate-100 dark:divide-slate-700/60">
          {filteredRetailers.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 text-center">
              No matching retailers found.
            </div>
          ) : (
            filteredRetailers.map((r, index) => {
              const isSelected = selectedRetailer?.id === r.id;
              const isHighlighted = highlightIndex === index;
              const beatName = beats.get(r.beatId) || 'Unknown Beat';

              return (
                <div
                  key={r.id}
                  onClick={() => handleSelect(r)}
                  onMouseEnter={() => setHighlightIndex(index)}
                  className={`p-2.5 cursor-pointer flex items-center justify-between text-xs transition ${
                    isHighlighted
                      ? 'bg-navy-50 dark:bg-navy-900/50'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-750'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Store className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {r.retailerName}
                      </span>
                      {r.contactNumber && (
                        <span className="text-[10px] text-slate-400 ml-2">
                          ({r.contactNumber})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Beat Badge */}
                  <div className="flex items-center space-x-1.5 flex-shrink-0">
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                      <MapPin className="w-2.5 h-2.5" />
                      <span>{beatName}</span>
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
