// Shared class list + single-char code mapping for Olympiad ID generation.
// Code must be a single character so the ID format stays fixed:
//   [6 char CRM][1 char classCode][4 digit continuous number]
// Codes: PG=P, Nursery=N, LKG=K, UKG=U

export interface ClassDef {
  name: string; // display + stored className, e.g. "Class 5", "PG"
  code: string; // single char used in the olympiad id
}

export const CLASSES: ClassDef[] = [
  { name: 'PG', code: 'P' },
  { name: 'Nursery', code: 'N' },
  { name: 'LKG', code: 'K' },
  { name: 'UKG', code: 'U' },
];

export const CLASS_CODE_BY_NAME: Record<string, string> = Object.fromEntries(
  CLASSES.map((c) => [c.name, c.code])
);
