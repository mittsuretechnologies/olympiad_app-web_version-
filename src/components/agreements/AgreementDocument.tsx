'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { AgreementDoc, AgreementItem } from '@/lib/agreements/school-onboarding';

/**
 * Renders a structured legal agreement as a typeset document.
 *
 * Set in the portal's own sans (Inter) so the contract reads as part of the
 * product rather than a pasted Word file, at a capped measure with a fixed
 * number column: section titles and clause text share one left edge, and the
 * numbers hang in the gutter the way they do in a printed contract.
 *
 * Only presentation lives here. The wording comes verbatim from the doc object
 * (which is what gets hashed and emailed), so restyling never changes the text
 * a school accepted.
 *
 * Each section gets id="agr-<section.id>" for the table of contents.
 *
 * Blocks reveal as they scroll into view: they come in from a soft blur and a
 * small rise, once each, so the eye is drawn to the paragraph being reached.
 * Reduced-motion users get the plain document.
 */

// Labels as Word renders the source document: clause "1.1" shows as "1.1.",
// a first-level item "(a)" as "a.", and a second-level item as "1.", "2." …
// Display only: the stored numbers (and the hashed text) are unchanged.
const clauseLabel = (n?: string) => (n && /^\d+\.\d+$/.test(n) ? `${n}.` : n);
const itemLabel = (n: string, depth: number, index: number) =>
  depth === 0 ? n.replace(/^\((\w+)\)$/, '$1.') : `${index + 1}.`;

const REVEAL = {
  initial: { opacity: 0, y: 14, filter: 'blur(6px)' },
  whileInView: { opacity: 1, y: 0, filter: 'blur(0px)' },
  viewport: { once: true, margin: '0px 0px -8% 0px' },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
};

const NUM_COL = 'grid grid-cols-[2.25rem_1fr] sm:grid-cols-[2.75rem_1fr] gap-x-1';

function Items({ items, depth = 0 }: { items?: AgreementItem[]; depth?: number }) {
  if (!items?.length) return null;
  return (
    <ol className="mt-2.5 space-y-2 list-none">
      {items.map((it, i) => (
        <li key={it.n} className="grid grid-cols-[2rem_1fr] gap-x-1">
          <span className="tabular-nums text-[#677285]">{itemLabel(it.n, depth, i)}</span>
          <div>
            {it.lead && <strong className="font-semibold text-[#0B1B36]">{it.lead} </strong>}
            {it.text}
            <Items items={it.items} depth={depth + 1} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function AgreementDocument({
  doc, compact = false, preparedFor,
}: { doc: AgreementDoc; compact?: boolean; preparedFor?: string }) {
  // Preamble shape: an opening line, one paragraph per party, a closing line.
  const [opening, ...rest] = doc.preamble;
  const closing = rest.length > 2 ? rest[rest.length - 1] : undefined;
  const parties = closing ? rest.slice(0, -1) : rest;
  const partyNames = ['The Company', preparedFor || 'The School'];
  const reveal = useReducedMotion() ? {} : REVEAL;

  return (
    <article className={`text-[#1F2937] ${compact ? 'text-[13px]' : 'text-[14px]'} leading-[1.65] [font-feature-settings:'cv11','ss01']`}>
      {/* Title block */}
      <header className="pb-4 border-b border-[#E6E8EC]">
        <h1 className="text-[18px] sm:text-[19px] leading-[1.3] font-semibold tracking-[-0.01em] text-[#0B1B36]">{doc.title}</h1>
        <p className="mt-1 text-[12px] leading-snug text-[#677285]">
          Version {doc.version} <span aria-hidden="true">·</span> Last updated {doc.lastUpdated}
          {preparedFor && <> <span aria-hidden="true">·</span> Prepared for {preparedFor}</>}
        </p>
      </header>

      {/* Notice */}
      <motion.div {...reveal} className="mt-5 rounded-md border border-[#E6E8EC] bg-[#F8F9FB] px-4 py-3">
        <p className="text-[12px] font-semibold text-[#2A3446]">IMPORTANT – PLEASE READ:</p>
        <p className="mt-1 text-[13px] leading-[1.6] text-[#475265]">{doc.notice}</p>
      </motion.div>

      {/* Parties */}
      <motion.div {...reveal} className="mt-6">
        <p>{opening}</p>
        <div className="mt-3 grid md:grid-cols-2 gap-3">
          {parties.map((p, i) => (
            <div key={i} className="rounded-lg border border-[#E6E8EC] bg-[#F8F9FB] p-3.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#677285]">Party {i + 1}</p>
              <p className="mt-0.5 text-[13px] font-semibold text-[#0B1B36]">{partyNames[i] ?? `Party ${i + 1}`}</p>
              <p className="mt-1.5 text-[12.5px] leading-[1.6] text-[#475265]">{p}</p>
            </div>
          ))}
        </div>
        {closing && <p className="mt-3">{closing}</p>}
      </motion.div>

      {/* Sections */}
      {doc.sections.map(s => (
        <section key={s.id} id={`agr-${s.id}`} className="mt-8 scroll-mt-20">
          <motion.h2 {...reveal} className={`${NUM_COL} items-baseline text-[15px] font-semibold tracking-[-0.01em] text-[#0B1B36]`}>
            <span className="tabular-nums text-[#1559C7]">{s.n ? `${s.n}.` : ''}</span>
            <span>{s.title}</span>
          </motion.h2>

          {/* Table before the clauses, matching the order in the source document. */}
          {s.table && (
            <>
              {/* Desktop: true table */}
              <motion.div {...reveal} className="mt-3 hidden md:block overflow-hidden rounded-lg border border-[#E6E8EC]">
                <table className="w-full border-collapse text-[12.5px] leading-[1.5]">
                  <thead>
                    <tr className="bg-[#F4F5F7]">
                      {s.table.columns.map(h => (
                        <th key={h} scope="col" className="px-4 py-2.5 text-left text-[11.5px] font-semibold text-[#475265] border-b border-[#E6E8EC]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.table.rows.map(r => (
                      <tr key={r[0]} className="align-top border-b border-[#E6E8EC] last:border-0">
                        <th scope="row" className="w-[24%] px-4 py-3 text-left font-semibold text-[#0B1B36]">{r[0]}</th>
                        <td className="px-4 py-3 text-[#2A3446] border-l border-[#E6E8EC]">{r[1]}</td>
                        <td className="px-4 py-3 text-[#2A3446] border-l border-[#E6E8EC]">{r[2]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
              {/* Mobile: one card per responsibility, no sideways scrolling */}
              <div className="mt-3 space-y-2.5 md:hidden text-[13px] leading-[1.55]">
                {s.table.rows.map(r => (
                  <motion.div key={r[0]} {...reveal} className="rounded-lg border border-[#E6E8EC] p-3.5">
                    <p className="font-semibold text-[#0B1B36]">{r[0]}</p>
                    <p className="mt-2 text-[11.5px] font-semibold text-[#677285]">{s.table!.columns[1]}</p>
                    <p className="text-[#2A3446]">{r[1]}</p>
                    <p className="mt-2 text-[11.5px] font-semibold text-[#677285]">{s.table!.columns[2]}</p>
                    <p className="text-[#2A3446]">{r[2]}</p>
                  </motion.div>
                ))}
              </div>
            </>
          )}

          <div className="mt-2.5 space-y-2.5">
            {s.clauses.map((c, i) => (
              <motion.div key={c.n ?? i} {...reveal} className={NUM_COL}>
                <span className="pt-[1px] text-[12.5px] tabular-nums text-[#677285]">{clauseLabel(c.n)}</span>
                <div>
                  {c.lead && <strong className="font-semibold text-[#0B1B36]">{c.lead} </strong>}
                  {c.text}
                  <Items items={c.items} />
                </div>
              </motion.div>
            ))}
          </div>

        </section>
      ))}

      <div className="mt-10 flex items-center gap-3 text-[11.5px] text-[#677285]">
        <span className="h-px flex-1 bg-[#E6E8EC]" />
        End of agreement · Version {doc.version}
        <span className="h-px flex-1 bg-[#E6E8EC]" />
      </div>
    </article>
  );
}
