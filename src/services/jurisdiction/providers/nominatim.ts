import { GeocodingProvider, Location, AddressResolutionError } from '../types';

export class NominatimProvider implements GeocodingProvider {
  async geocode(address: string): Promise<Location> {
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.append('q', address);
      url.searchParams.append('format', 'json');
      url.searchParams.append('addressdetails', '1');
      url.searchParams.append('limit', '5');
      // Adding a generic user agent as required by Nominatim terms of use
      
      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'RentalHousingLawNavigatorHackathonApp/1.0',
        }
      });

      if (!response.ok) {
        throw new AddressResolutionError('Geocoding API failure', 'API_FAILURE');
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        throw new AddressResolutionError('Could not find the specified address.', 'INVALID_ADDRESS');
      }

      // Check if it's too ambiguous or not specific enough (e.g. just a state)
      // Usually, we want at least a city or street for property-level laws
      const bestMatch = data[0];
      const addr = bestMatch.address;
      
      if (!addr.state) {
          throw new AddressResolutionError('Address is too ambiguous. State could not be determined.', 'AMBIGUOUS_ADDRESS');
      }

      const street = addr.road ? `${addr.house_number || ''} ${addr.road}`.trim() : '';
      const city = addr.city || addr.town || addr.village || addr.municipality || '';
      const county = addr.county || '';
      
      // Ensure we have at least a city or county to be useful
      if (!city && !county) {
        throw new AddressResolutionError('Address is too broad. Please include a city and street.', 'AMBIGUOUS_ADDRESS');
      }

      return {
        street,
        city,
        county,
        state: addr.state,
        zip: addr.postcode || '',
        latitude: parseFloat(bestMatch.lat),
        longitude: parseFloat(bestMatch.lon),
        rawAddress: bestMatch.display_name
      };

    } catch (error) {
      if (error instanceof AddressResolutionError) throw error;
      console.error('Nominatim Geocoding Error:', error);
      throw new AddressResolutionError('Failed to contact geocoding service.', 'API_FAILURE');
    }
  }
}
