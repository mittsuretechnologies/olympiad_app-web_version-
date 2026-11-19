import type { ReactNode } from 'react';

/**
 * Handbook inline markup -> React: <b>…</b>, <i>…</i>, <mark>…</mark> and
 * <a href="…">…</a>. Anything else stays literal text (no HTML injection).
 * Its own file so the evaluator Terms gate can use it without pulling in the
 * book component and its fonts.
 */
export function rich(text: string): ReactNode {
  type Frame = { tag: string; href?: string; kids: ReactNode[] };
  const root: Frame = { tag: 'root', kids: [] };
  const stack: Frame[] = [root];
  const re = /<(\/?)(b|i|mark|a)(?:\s+href="([^"]*)")?>/g;
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) stack[stack.length - 1].kids.push(text.slice(last, m.index));
    last = m.index + m[0].length;
    if (!m[1]) { stack.push({ tag: m[2], href: m[3], kids: [] }); continue; }
    if (stack.length < 2) continue;
    const f = stack.pop()!;
    const el =
      f.tag === 'b' ? <b key={k++}>{f.kids}</b>
      : f.tag === 'i' ? <i key={k++}>{f.kids}</i>
      : f.tag === 'mark' ? <mark key={k++}>{f.kids}</mark>
      : <a key={k++} href={f.href} target="_blank" rel="noopener noreferrer">{f.kids}</a>;
    stack[stack.length - 1].kids.push(el);
  }
  if (last < text.length) stack[stack.length - 1].kids.push(text.slice(last));
  while (stack.length > 1) { const f = stack.pop()!; stack[stack.length - 1].kids.push(...f.kids); }
  return root.kids;
}
