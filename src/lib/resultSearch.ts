// Shared by the Result page's two endpoints so the school list and the opened
// school's student list always agree on what a search matches.
//
// A search matches a school (name, school code, city) — then ALL its students
// count — or, failing that, individual students (name, Olympiad code).

export const normaliseQuery = (q: string | null | undefined) => (q || '').trim().toLowerCase();

export function schoolMatchesQuery(q: string, s: { name: string; schoolId: string; city: string | null }): boolean {
  if (!q) return true;
  return s.name.toLowerCase().includes(q) || s.schoolId.toLowerCase().includes(q) || (s.city || '').toLowerCase().includes(q);
}

export function studentMatchesQuery(q: string, m: { name: string; code: string }): boolean {
  if (!q) return true;
  return m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q);
}
