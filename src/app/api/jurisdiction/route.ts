import { NextResponse } from 'next/server';
import { resolveAddress, resolveJurisdictions, AddressResolutionError } from '@/services/jurisdiction';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    // Step 1: Geocode
    const location = await resolveAddress(address);

    // Step 2: Resolve Jurisdictions
    const jurisdictions = resolveJurisdictions(location);

    return NextResponse.json({
      location,
      jurisdictions,
      formatted_address: location.rawAddress,
    });

  } catch (error: any) {
    if (error instanceof AddressResolutionError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 } // Bad request for invalid addresses
      );
    }
    
    console.error('Jurisdiction API Error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during address resolution.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
