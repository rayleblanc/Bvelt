const TRADES = [
  { label: "HVAC / AC / Cooling", value: "hvac" },
  { label: "Plumbing", value: "plumbing" },
  { label: "Lawn Care / Landscaping", value: "lawn" },
  { label: "Roofing", value: "roofing" },
  { label: "Electrician", value: "general" },
  { label: "Cleaning", value: "general" },
  { label: "Pool Service", value: "general" },
  { label: "Handyman", value: "general" },
  { label: "Painting", value: "general" },
];

const CITIES = [
  "Naples, FL", "Miami, FL", "Fort Myers, FL", "Cape Coral, FL",
  "Bonita Springs, FL", "Marco Island, FL", "Tampa, FL", "Orlando, FL",
  "Austin, TX", "Houston, TX", "Dallas, TX"
];

export const getTradeSuggestions = (query: string) => {
  const q = query.toLowerCase();
  return TRADES.filter(t => t.label.toLowerCase().includes(q) || t.value.toLowerCase().includes(q)).slice(0, 8);
};

export const getCitySuggestions = (query: string) => {
  const q = query.toLowerCase();
  return CITIES.filter(c => c.toLowerCase().includes(q)).map(c => ({ label: c, value: c })).slice(0, 8);
};
