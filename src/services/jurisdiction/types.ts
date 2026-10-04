export interface Location {
  street: string;
  city: string;
  county: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
  rawAddress: string;
}

export interface JurisdictionNode {
  name: string;
  level: 'State' | 'County' | 'City' | 'Local';
}

export interface JurisdictionResult {
  location: Location;
  jurisdictions: JurisdictionNode[];
}

export class AddressResolutionError extends Error {
  constructor(message: string, public code: 'INVALID_ADDRESS' | 'AMBIGUOUS_ADDRESS' | 'UNSUPPORTED_JURISDICTION' | 'API_FAILURE') {
    super(message);
    this.name = 'AddressResolutionError';
  }
}

export interface GeocodingProvider {
  geocode(address: string): Promise<Location>;
}
