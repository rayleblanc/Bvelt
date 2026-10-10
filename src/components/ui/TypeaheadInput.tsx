import React, { useState, useRef, useEffect } from 'react';

interface TypeaheadInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: { label: string; value: string }[];
  placeholder?: string;
  icon?: React.ReactNode;
}

export const TypeaheadInput: React.FC<TypeaheadInputProps> = ({ 
  label, value, onChange, suggestions, placeholder, icon 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filtered, setFiltered] = useState(suggestions);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFiltered(suggestions.filter(s => 
      s.label.toLowerCase().includes(value.toLowerCase()) || 
      s.value.toLowerCase().includes(value.toLowerCase())
    ));
  }, [value, suggestions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        {icon && <div className="absolute left-3.5 top-3 text-slate-500">{icon}</div>}
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full ${icon ? 'pl-10' : 'pl-4'} pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition`}
        />
      </div>
      {isOpen && filtered.length > 0 && value.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
          {filtered.slice(0, 8).map((s, i) => (
            <li 
              key={i} 
              className="px-4 py-2 text-xs text-slate-200 hover:bg-slate-800 cursor-pointer"
              onClick={() => {
                onChange(s.label);
                setIsOpen(false);
              }}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
