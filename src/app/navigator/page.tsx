'use client';
import { useEffect, useState } from 'react';

const BADGE: Record<string, string> = {
  applies: 'bg-green-100 text-green-800', unknown: 'bg-amber-100 text-amber-800',
  superseded: 'bg-purple-100 text-purple-800', not_yet_effective: 'bg-blue-100 text-blue-800',
  pending: 'bg-gray-200 text-gray-800',
};
const LABEL: Record<string, string> = {
  applies: 'Applies', unknown: 'Unknown', superseded: 'Superseded', not_yet_effective: 'Not yet effective', pending: 'Pending (not law)',
};

export default function Navigator() {
  const [q, setQ] = useState('');
  const [dates, setDates] = useState<string[]>([]);
  const [asOf, setAsOf] = useState('');
  const [matches, setMatches] = useState<any[]>([]);
  const [rec, setRec] = useState<any>(null);
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const [err, setErr] = useState('');

  useEffect(() => { fetch('/api/lookup').then(r => r.json()).then(d => {
    if (d.error) setErr(d.error); else { setDates(d.dates); setAsOf(d.as_of); } }); }, []);
  useEffect(() => {
    if (q.length < 2) { setMatches([]); return; }
    fetch(`/api/lookup?q=${encodeURIComponent(q)}&asof=${asOf}`).then(r => r.json()).then(d => setMatches(d.matches || []));
  }, [q, asOf]);
  const open = (id: string, date = asOf) =>
    fetch(`/api/lookup?id=${id}&asof=${date}`).then(r => r.json()).then(d => { setRec(d.record); setAsOf(d.as_of); setMatches([]); });

  const grouped: Record<string, any[]> = {};
  (rec?.results || []).forEach((r: any) => { (grouped[r.category] ||= []).push(r); });

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-5">
      <div className="bg-yellow-50 border border-yellow-300 rounded p-3 text-sm">
        <b>Not legal advice.</b> This tool shows what public law text says for an address. Verify with the source or a qualified professional.
      </div>
      <h1 className="text-2xl font-bold">Rental Housing Law Navigator</h1>
      {err && <p className="text-red-600">{err}</p>}
      <div className="flex gap-3 flex-wrap items-center">
        <input className="border rounded p-2 flex-1 min-w-[260px]" placeholder="Search a sample address…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="border rounded p-2" value={asOf} onChange={e => { setAsOf(e.target.value); if (rec) open(rec.address_id, e.target.value); }}>
          {dates.map(d => <option key={d} value={d}>As of {d}</option>)}
        </select>
        <button className="border rounded px-3 py-2" onClick={() => setLang(lang === 'en' ? 'es' : 'en')}>{lang === 'en' ? 'Español' : 'English'}</button>
      </div>
      {matches.length > 0 && <ul className="border rounded divide-y">{matches.map(m =>
        <li key={m.address_id}><button className="w-full text-left p-2 hover:bg-gray-50" onClick={() => open(m.address_id)}>{m.address}</button></li>)}</ul>}

      {rec && <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{rec.address}</h2>
          <p className="text-sm text-gray-600">As of <b>{rec.as_of}</b> · Jurisdictions: {rec.jurisdiction_stack.map((s: any) => s.name).join(' › ')} ·
            Confidence: <b>{rec.confidence}</b>{rec.city_source === 'postal_city_fallback' && ' · city taken from postal address (unverified)'}</p>
          <p className="text-sm text-gray-600">Known facts: year built {rec.facts.year_built ?? 'unknown'}, units {rec.facts.units ?? 'unknown'}, owner type unknown.</p>
        </div>
        {rec.conflict_flags.map((f: any, i: number) => <div key={i} className="bg-red-50 border border-red-300 rounded p-3 text-sm">⚠ Possible conflict – needs human review: {f.note}</div>)}
        {Object.entries(grouped).map(([cat, rs]) => <div key={cat} className="border rounded">
          <h3 className="font-semibold bg-gray-50 p-2 capitalize">{cat.replace(/_/g, ' ')}</h3>
          {rs.map((r: any) => <details key={r.rule_id} className="p-3 border-t">
            <summary className="cursor-pointer flex gap-2 items-center flex-wrap">
              <span className={`px-2 py-0.5 rounded text-xs ${BADGE[r.result]}`}>{LABEL[r.result]}</span>
              <span className="text-sm">{(lang === 'es' && r.summary_plain_es) || r.summary_plain || r.key_value}</span>
            </summary>
            <div className="mt-2 text-sm space-y-1">
              <p><b>{r.level}</b>: {r.jurisdiction} · {r.citation}{r.effective_date && ` · effective ${r.effective_date}`}</p>
              <p className="text-gray-600">{r.reason}</p>
              {r.missing_facts.length > 0 && <p className="text-amber-700">Unknown because missing: {r.missing_facts.join(', ')}</p>}
              {r.superseded_by && <p className="text-purple-700">Superseded by rule {r.superseded_by}</p>}
              <blockquote className="border-l-4 pl-3 italic text-gray-700">“{r.quoted_span}”</blockquote>
              <p className="text-xs text-gray-500">Source: {r.source_url ? <a className="underline" href={r.source_url} target="_blank">{r.source_url}</a> : 'corpus document'} · retrieved {r.retrieval_date || 'n/a'}</p>
            </div>
          </details>)}
        </div>)}
        {rec.no_rule_findings.length > 0 && <details className="text-sm"><summary className="cursor-pointer">No rule found in the provided corpus ({rec.no_rule_findings.length})</summary>
          <ul className="list-disc ml-6">{rec.no_rule_findings.map((f: any, i: number) => <li key={i}>{f.jurisdiction} ({f.level}) – {f.category.replace(/_/g, ' ')}</li>)}</ul></details>}
        <p className="text-xs text-gray-500">{rec.disclaimer}</p>
      </section>}
    </main>
  );
}
