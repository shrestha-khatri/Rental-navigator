'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapBoundsFetcher({ setBounds }: { setBounds: (b: string) => void }) {
  const map = useMapEvents({
    moveend() {
      const bounds = map.getBounds();
      setBounds(`${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`);
    }
  });
  return null;
}

export default function MapUI({ properties, onBoundsChange }: { properties: any[], onBoundsChange: (b: string) => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">Loading Map...</div>;

  return (
    <MapContainer 
      center={[37.791, -122.393]} 
      zoom={11} 
      className="w-full h-full z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapBoundsFetcher setBounds={onBoundsChange} />
      
      {properties.map(p => (
        <Marker key={p.id} position={[p.latitude, p.longitude]}>
          <Popup>
            <div className="font-sans">
              <h3 className="font-bold">{p.street}</h3>
              <p className="text-xs text-gray-500">{p.city}, {p.state}</p>
              
              {p.rule_caches?.length > 0 && (
                <div className="mt-2 border-t pt-2">
                  <p className="text-xs font-bold text-gray-700">Eviction Notice Rule:</p>
                  <p className="text-sm">
                    {p.rule_caches[0].status === 'DEPENDS' ? '⚠️ Depends on facts' : `✅ ${p.rule_caches[0].value} ${p.rule_caches[0].unit}`}
                  </p>
                </div>
              )}
              
              {p.user_actions?.some((a:any) => a.living_status === 'CURRENT') && (
                <div className="mt-2 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded border border-blue-200">
                  🏠 A friend lives here
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
