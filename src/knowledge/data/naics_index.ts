export interface NaicsEntry {
  code: string;
  title: string;
  parentCode?: string;
  aliases: string[];
  relatedTerms: string[];
}

export const COMPACT_NAICS_INDEX: Record<string, NaicsEntry> = {
  "238220": {
    code: "238220",
    title: "Plumbing, Heating, and Air-Conditioning Contractors",
    aliases: ["HVAC", "Plumber", "Fontanero", "Aire Acondicionado", "Climatización"],
    relatedTerms: ["AC installation", "Heating repair", "Desatascos", "Reparación de tuberías"]
  },
  "722511": {
    code: "722511",
    title: "Full-Service Restaurants",
    aliases: ["Restaurante", "Cafetería", "Food Service", "Dine-in"],
    relatedTerms: ["Restaurant", "Fine Dining", "Casual Dining"]
  },
  "541110": {
    code: "541110",
    title: "Offices of Lawyers",
    aliases: ["Abogado", "Lawyer", "Law Firm", "Bufete", "Attorney"],
    relatedTerms: ["Legal Services", "Asesoría Legal", "Litigación"]
  },
  "812112": {
    code: "812112",
    title: "Beauty Salons",
    aliases: ["Peluquería", "Hair Salon", "Salón de Belleza", "Estética"],
    relatedTerms: ["Haircut", "Manicure", "Estilista"]
  }
};
