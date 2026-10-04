import { NextResponse } from 'next/server';
import { generateAnswer } from '@/services/ai';
import { retrieveLegalEvidence } from '@/services/retrieval';
import { getApplicableLaw } from '@/services/temporal';
import { validateCitations } from '@/services/citation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, jurisdictions, question, targetDate } = body;

    if (!address || !jurisdictions || !question || !targetDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const tDate = new Date(targetDate);

    // 1. Retrieve Evidence
    const evidence = await retrieveLegalEvidence({
        question,
        jurisdictions,
        targetDate: tDate
    });

    let pendingChanges: any[] = [];
    if (evidence.length > 0) {
        const temporalContext = await getApplicableLaw({
            jurisdiction: { name: evidence[0].jurisdiction, level: '' },
            topic: evidence[0].topic,
            targetDate: tDate
        });
        pendingChanges = temporalContext.pending;
    }

    // 2. Generate Answer (LLM)
    const rawAnswer = await generateAnswer({
        question,
        targetDate: tDate,
        address,
        jurisdictions,
        evidence,
        pendingChanges
    });

    // 3. Citation Validation Layer
    const validationResult = await validateCitations(
        rawAnswer.claims || [], 
        evidence, 
        tDate
    );

    const validClaims = validationResult.validatedClaims.filter((c: any) => c.isValid);
    
    // Filter out completely invalid claims, or mark them so the UI can display warnings
    const finalAnswer = {
        ...rawAnswer,
        claims: validClaims
    };

    if (validClaims.length === 0 && rawAnswer.claims?.length > 0) {
        finalAnswer.shortAnswer = "I couldn't find sufficient authoritative evidence to answer this reliably.";
    }

    return NextResponse.json({
        answer: finalAnswer,
        validation: {
            citationCoverage: validationResult.citationCoverage,
            unsupportedClaimCount: validationResult.unsupportedClaimCount,
            isFullyEvidenceBacked: validationResult.isFullyEvidenceBacked
        },
        evidence 
    });

  } catch (error: any) {
    console.error('Answer API Error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during answer generation.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
