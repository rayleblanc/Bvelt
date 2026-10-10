import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap } from 'lucide-react';

interface AutocompleteInputProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  prefix?: string;
  getSuggestions?: (query: string) => Promise<{label: string, subLabel?: string, value: any}[]>;
  onSelect?: (item: {label: string, subLabel?: string, value: any}) => void;
  debounceMs?: number;
}

export function AutocompleteInput({ 
  label, 
  placeholder, 
  value, 
  onChange, 
  type = "text", 
  prefix,
  getSuggestions,
  onSelect,
  debounceMs = 600
}: AutocompleteInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<{label: string, subLabel?: string, value: any}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // To avoid refetching if value changed because of selection
  const skipNextFetch = useRef(false);

  useEffect(() => {
    return () => {
      setSuggestions([]);
      setShowDropdown(false);
    };
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let isCancelled = false;

    if (!getSuggestions || !value) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }

    timer = setTimeout(async () => {
      setIsLoading(true);
      setShowDropdown(true);
      try {
        const results = await getSuggestions(value);
        if (!skipNextFetch.current && !isCancelled) {
           setSuggestions(results);
        }
      } catch (err) {
        console.error("Autocomplete fetch error:", err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [value, getSuggestions, debounceMs]);

  return (
    <div className="relative">
      <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">{label}</label>
      <div className={`
        flex items-center bg-slate-50 dark:bg-slate-900 border transition-all duration-300 rounded-xl overflow-hidden relative z-[50]
        ${isFocused 
          ? 'border-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.2)]' 
          : 'border-slate-200 dark:border-slate-800'
        }
      `}>
        {prefix && (
          <span className="pl-4 pr-1 text-slate-400 dark:text-slate-500 font-bold text-xs select-none">
            {prefix}
          </span>
        )}
        <input 
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            skipNextFetch.current = false;
            onChange(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => {
            setIsFocused(true);
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          onBlur={() => {
            setIsFocused(false);
            setTimeout(() => setShowDropdown(false), 200);
          }}
          className={`
            w-full bg-transparent outline-none text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 h-11 text-xs font-bold
            ${prefix ? 'pl-1 pr-4' : 'px-4'}
          `}
        />
      </div>

      <AnimatePresence>
        {showDropdown && (suggestions.length > 0 || isLoading) && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="absolute z-[250] left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto"
          >
            {isLoading ? (
               <div className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2 animate-pulse">
                  <Zap size={14} className="text-indigo-500 animate-spin" />
                  Buscando...
               </div>
            ) : suggestions.length === 0 && value.length >= 3 ? (
               <div className="p-4 text-xs font-semibold text-slate-400 dark:text-slate-500 text-center italic">
                  No se encontraron resultados
               </div>
            ) : (
               <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {suggestions.map((item, idx) => (
                     <li 
                        key={idx}
                        onClick={() => {
                           skipNextFetch.current = true;
                           setSuggestions([]);
                           setShowDropdown(false);
                           if (onSelect) {
                             onSelect(item);
                           } else {
                             onChange(item.value);
                           }
                        }}
                        className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex flex-col text-left transition"
                     >
                        <span className="font-extrabold text-sm text-slate-800 dark:text-white leading-tight">{item.label}</span>
                        {item.subLabel && <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tracking-tight">{item.subLabel}</span>}
                     </li>
                  ))}
               </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
