import React, { useCallback } from 'react';
import { AutocompleteInput } from './AutocompleteInput';

export function CityAutocomplete({ label, placeholder, value, onChange }: { label: string, placeholder?: string, value: string, onChange: (v: string) => void }) {
  const getSuggestions = useCallback(async (query: string) => {
     if (!query || query.length < 3) return [];
     try {
       // Cambiado a Photon API (basada en OSM) para mejor rendimiento y límites
       const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`);
       if (res.ok) {
         const data = await res.json() as { features?: any[] };
         return (data.features || []).map((f: any) => {
           const p = f.properties;
           const label = p.name || p.city || '';
           const subLabel = [p.city, p.state, p.country].filter(Boolean).join(', ');
           return { 
             label: label, 
             subLabel: subLabel, 
             value: subLabel ? `${label}, ${subLabel}` : label
           };
         });
       }
     } catch (e) {
       console.warn("Location search error, falling back:", e);
     }
     return [];
  }, []);

  return (
    <AutocompleteInput
      label={label}
      placeholder={placeholder || "Houston, TX"}
      value={value}
      onChange={onChange}
      debounceMs={500}
      getSuggestions={getSuggestions}
    />
  );
}

export function NicheAutocomplete({ label, placeholder, value, onChange }: { label: string, placeholder?: string, value: string, onChange: (v: string) => void }) {
  const getSuggestions = useCallback(async (query: string) => {
     const nicheList = [
       "Air Conditioning / HVAC", "Tree Services & Arborists", "Classic Barbershop", "Wellness & Fitness",
       "Real Estate", "Locksmith Services", "Concrete Contractors", "Construction & Renovation",
       "Pest Control", "Pet Care/Grooming", "Car Detailing", "Electrical Services", "Solar Energy",
       "Fence Installation", "Epoxy Flooring Installers", "Windows & Doors Installation",
       "Carpet & Upholstery Cleaning", "Chimney Sweep & Repair", "Garage Door Services", "Junk Removal",
       "Appliance Repair", "Damage Restoration", "Towing & Roadside Services", "Cleaning (Home/Office)",
       "Gardening / Landscaping", "Pool Maintenance", "Plumbing", "Painting / Decoration",
       "Roofing", "Handyman Services", "Snow Removal", "Moving & Logistics", "Hair Salon",
       "Nail Salon", "Restaurant / Cafe", "Security Services"
     ];
     if (!query) return [];
     const term = query.toLowerCase();
     return nicheList
       .filter(n => n.toLowerCase().includes(term))
       .slice(0, 5)
       .map(n => ({ label: n, value: n }));
  }, []);

  return (
    <AutocompleteInput
      label={label}
      placeholder={placeholder || "E.g. HVAC"}
      value={value}
      onChange={onChange}
      getSuggestions={getSuggestions}
    />
  );
}
