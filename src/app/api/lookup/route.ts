import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Reads data/lookups_by_date.json produced by `python -m pipeline.run lookups`.
let cache: Record<string, any[]> | null = null;
function load() {
  if (cache) return cache;
  const p = path.join(process.cwd(), 'data', 'lookups_by_date.json');
  if (!fs.existsSync(p)) return null;
  cache = JSON.parse(fs.readFileSync(p, 'utf-8'));
  return cache;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = load();
  if (!data) {
    return NextResponse.json({ error: 'No lookup data yet. Run: python -m pipeline.run all' }, { status: 404 });
  }
  const dates = Object.keys(data).sort();
  const asOf = searchParams.get('asof') && data[searchParams.get('asof')!] ? searchParams.get('asof')! : dates[dates.length - 1];
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const id = searchParams.get('id');
  const rows = data[asOf];
  if (id) {
    const rec = rows.find((r: any) => r.address_id === id);
    return NextResponse.json({ dates, as_of: asOf, record: rec || null });
  }
  const matches = q.length < 2 ? [] : rows.filter((r: any) => r.address.toLowerCase().includes(q)).slice(0, 15)
    .map((r: any) => ({ address_id: r.address_id, address: r.address }));
  return NextResponse.json({ dates, as_of: asOf, matches });
}
