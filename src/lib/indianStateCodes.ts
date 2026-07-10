// Standard Indian state/UT codes (ISO 3166-2:IN, minus the "IN-" prefix).
// Used to auto-derive School.stateCode from School.state, and to let admins
// assign evaluators to a state by its short code instead of full name.
export const INDIAN_STATE_CODES: Record<string, string> = {
  'Andhra Pradesh': 'AP',
  'Arunachal Pradesh': 'AR',
  'Assam': 'AS',
  'Bihar': 'BR',
  'Chhattisgarh': 'CG',
  'Goa': 'GA',
  'Gujarat': 'GJ',
  'Haryana': 'HR',
  'Himachal Pradesh': 'HP',
  'Jharkhand': 'JH',
  'Karnataka': 'KA',
  'Kerala': 'KL',
  'Madhya Pradesh': 'MP',
  'Maharashtra': 'MH',
  'Manipur': 'MN',
  'Meghalaya': 'ML',
  'Mizoram': 'MZ',
  'Nagaland': 'NL',
  'Odisha': 'OD',
  'Punjab': 'PB',
  'Rajasthan': 'RJ',
  'Sikkim': 'SK',
  'Tamil Nadu': 'TN',
  'Telangana': 'TG',
  'Tripura': 'TR',
  'Uttar Pradesh': 'UP',
  'Uttarakhand': 'UK',
  'West Bengal': 'WB',
  // Union Territories
  'Andaman and Nicobar Islands': 'AN',
  'Chandigarh': 'CH',
  'Dadra and Nagar Haveli and Daman and Diu': 'DN',
  'Delhi': 'DL',
  'Jammu and Kashmir': 'JK',
  'Ladakh': 'LA',
  'Lakshadweep': 'LD',
  'Puducherry': 'PY',
};

const CODE_TO_STATE: Record<string, string> = Object.fromEntries(
  Object.entries(INDIAN_STATE_CODES).map(([name, code]) => [code, name])
);

export function stateNameToCode(stateName: string | null | undefined): string | null {
  if (!stateName) return null;
  return INDIAN_STATE_CODES[stateName.trim()] ?? null;
}

export function stateCodeToName(code: string | null | undefined): string | null {
  if (!code) return null;
  return CODE_TO_STATE[code.trim().toUpperCase()] ?? null;
}
