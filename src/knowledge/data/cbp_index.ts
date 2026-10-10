export interface CbpEntry {
  naicsCode: string;
  geographyId: string; // e.g. "cbsa_houston" or "state_tx"
  establishments: number;
  employment: number;
  annualPayroll1000s: number;
  year: number;
}

export const COMPACT_CBP_INDEX: Record<string, CbpEntry> = {
  "238220_houston_tx": {
    naicsCode: "238220",
    geographyId: "houston_tx",
    establishments: 1245,
    employment: 18450,
    annualPayroll1000s: 1125000,
    year: 2023
  },
  "722511_houston_tx": {
    naicsCode: "722511",
    geographyId: "houston_tx",
    establishments: 3420,
    employment: 65120,
    annualPayroll1000s: 1450000,
    year: 2023
  },
  "238220_miami_fl": {
    naicsCode: "238220",
    geographyId: "miami_fl",
    establishments: 890,
    employment: 11200,
    annualPayroll1000s: 675000,
    year: 2023
  }
};
