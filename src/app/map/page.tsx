'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Filter, CalendarClock, Users, MapPin } from 'lucide-react';
import { format } from 'date-fns';

const MapUI = dynamic(() => import('@/components/MapUI'), { ssr: false });

export default function MapPage() {
  const [properties, setProperties] = useState([]);
  const [bounds, setBounds] = useState('');
  const [targetDate, setTargetDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [showFriendsOnly, setShowFriendsOnly] = useState(false);
  const [userId] = useState('demo-alice-id'); // In a real app, this comes from Auth session

  useEffect(() => {
    // We assume Alice's ID is what we'll mock. Let's fetch the actual ID from the DB in a real app, 
    // but for the demo we'll just fetch without strict ID if we can't find it, or use a known one.
    // To make the demo robust, the API accepts userId.
    const timer = setTimeout(() => fetchProperties(), 300); return () => clearTimeout(timer);
  }, [bounds, targetDate]);

  const fetchProperties = async () => {
    try {
      const res = await fetch(`/api/map/properties?bbox=${bounds}&date=${targetDate}&userId=${userId}`);
      const data = await res.json();
      setProperties(data.properties || []);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredProperties = properties.filter((p: any) => {
    if (showFriendsOnly) {
      return p.user_actions?.some((a: any) => a.is_liked || a.living_status);
    }
    return true;
  });

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50">
      {/* Sidebar List */}
      <div className="w-full md:w-1/3 h-1/2 md:h-full bg-white shadow-xl z-10 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="text-blue-600" /> Neighbourhood Map
          </h1>
          <p className="text-sm text-gray-500 mt-1">Law-based filters & Social Layer</p>
          
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Target Date</label>
              <input 
                type="date" 
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            
            <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
              <span className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" /> Friends Network
              </span>
              <button 
                onClick={() => setShowFriendsOnly(!showFriendsOnly)}
                className={`w-10 h-5 rounded-full transition-colors relative ${showFriendsOnly ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform ${showFriendsOnly ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            {filteredProperties.length} Properties Found
          </p>
          
          {filteredProperties.map((p: any) => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-blue-300 transition cursor-pointer">
              <h3 className="font-bold text-gray-900">{p.street}</h3>
              <p className="text-xs text-gray-500 mb-3">{p.city}, {p.state}</p>
              
              {p.rule_caches?.length > 0 && (
                <div className="bg-gray-50 p-2 rounded border border-gray-100 text-xs text-gray-700">
                  <span className="font-semibold text-gray-900">Eviction Notice: </span>
                  {p.rule_caches[0].status === 'DEPENDS' ? (
                    <span className="text-amber-600 font-medium">Depends ({p.rule_caches[0].depends_reason})</span>
                  ) : (
                    <span className="text-green-600 font-medium">{p.rule_caches[0].value} {p.rule_caches[0].unit}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Map View */}
      <div className="w-full md:w-2/3 h-1/2 md:h-full relative">
        <MapUI properties={filteredProperties} onBoundsChange={setBounds} />
        
        <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm border border-gray-200 text-[10px] text-gray-500 z-[1000]">
          Legal information, not legal advice.
        </div>
      </div>
    </div>
  );
}
