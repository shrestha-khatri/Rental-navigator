import { NextResponse } from 'next/server';
import { compareLegalState } from '@/services/temporal';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, topic, dateA, dateB } = body;

    if (!address || !topic || !dateA || !dateB) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const comparison = await compareLegalState({
        address,
        topic,
        dateA: new Date(dateA),
        dateB: new Date(dateB)
    });

    return NextResponse.json(comparison);

  } catch (error: any) {
    console.error('Timeline API Error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during timeline resolution.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
