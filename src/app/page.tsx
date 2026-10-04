'use client';

import { useState } from 'react';
import { 
  Scale, MapPin, Building, ChevronRight, AlertCircle, 
  Loader2, ArrowRight, ShieldCheck, HelpCircle, FileText, 
  X, ExternalLink, CalendarClock, Activity, Star
} from 'lucide-react';
import { format } from 'date-fns';
import { DEMO_EXAMPLES, DemoExample } from '@/data/demoExamples';

export default function Home() {
  // State
  const [address, setAddress] = useState('');
  const [jurisdictionData, setJurisdictionData] = useState<any>(null);
  const [question, setQuestion] = useState('');
  const [answerData, setAnswerData] = useState<any>(null);
  const [validationData, setValidationData] = useState<any>(null);
  const [rawEvidence, setRawEvidence] = useState<any[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState({ geocode: false, answer: false, timeline: false });
  const [targetDate, setTargetDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [timelineMode, setTimelineMode] = useState(false);
  const [timelineData, setTimelineData] = useState<any>(null);
  const [demoCategoryFilter, setDemoCategoryFilter] = useState('All');

  // Chat & Viewer State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatTone, setChatTone] = useState('Normal');
  const [chatHistory, setChatHistory] = useState<{role: string, content: string}[]>([]);
  const [currentChatInput, setCurrentChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [sourceHealth, setSourceHealth] = useState<boolean | null>(null);

  const CATEGORIES = ['All', 'Rent', 'Deposits', 'Tenant Rights', 'Future Laws', 'Edge Cases'];
  const filteredDemos = DEMO_EXAMPLES.filter(d => demoCategoryFilter === 'All' || d.category === demoCategoryFilter);
  const featuredDemo = DEMO_EXAMPLES.find(d => d.isFeatured);

  const getSuggestedQuestions = () => {
    // Dynamically pull questions from demo examples based on the current address's city/state
    if (!jurisdictionData) return [];
    const locationString = jurisdictionData.formatted_address || '';
    const relevant = DEMO_EXAMPLES.filter(d => locationString.includes(d.address.split(',')[0]));
    if (relevant.length > 0) return relevant.slice(0, 5).map(r => r.question);
    
    // Fallback defaults
    return [
      "Can my landlord raise my rent?",
      "How much can my landlord charge as a security deposit?",
      "How much notice is required before eviction?",
      "Can my landlord enter without notice?",
      "What rental rules change next year?"
    ];
  };

  const handleRunDemo = (demo: DemoExample) => {
    setAddress(demo.address);
    setQuestion(demo.question);
    // Sequence: set state, then immediately trigger geocode which will then wait for user to hit Ask, OR automate the whole flow.
    // The requirement says: "Clicking the button should automatically populate the address and question and take the user into the normal application flow."
    handleGeocode(undefined, demo.address, demo.question);
  };

  const fetchUrlHealth = async (url: string) => {
    setSourceHealth(null);
    try {
      const res = await fetch('/api/health-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      setSourceHealth(data.ok);
    } catch {
      setSourceHealth(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent, presetMsg?: string) => {
    e.preventDefault();
    const msg = presetMsg || currentChatInput;
    if (!msg.trim() || isChatLoading) return;

    setCurrentChatInput('');
    const newHistory = [...chatHistory, { role: 'user', content: msg }];
    setChatHistory(newHistory);
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          jurisdictions: jurisdictionData?.jurisdictions,
          date: targetDate,
          question,
          answer: answerData,
          evidence: rawEvidence,
          history: newHistory.slice(0, -1), // Everything before current msg
          tone: chatTone,
          newMessage: msg
        })
      });
      
      if (!res.body) throw new Error('No stream available');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      
      setChatHistory(prev => [...prev, { role: 'assistant', content: '' }]);
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setChatHistory(prev => {
          const updated = [...prev];
          updated[updated.length - 1].content += chunk;
          return updated;
        });
      }
    } catch (err: any) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'An error occurred while generating the response.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // 1. Resolve Address
  const handleGeocode = async (e?: React.FormEvent, presetAddr?: string, autoAskQuestion?: string) => {
    if (e) e.preventDefault();
    const addr = presetAddr || address;
    if (!addr.trim()) return;

    setIsLoading(prev => ({ ...prev, geocode: true }));
    setError(null);
    setJurisdictionData(null);
    setAnswerData(null);
    setTimelineData(null);
    setTimelineMode(false);

    if (presetAddr) setAddress(presetAddr);

    try {
      const res = await fetch('/api/jurisdiction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resolve address');
      setJurisdictionData(data);
      
      // If triggered from a demo card, automatically kick off the question phase
      if (autoAskQuestion) {
          handleAsk(undefined, autoAskQuestion, undefined, data);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(prev => ({ ...prev, geocode: false }));
    }
  };

  // 2. Get Answer
  const handleAsk = async (e?: React.FormEvent, presetQ?: string, date?: string, presetJurisData?: any) => {
    if (e) e.preventDefault();
    const q = presetQ || question;
    const jd = presetJurisData || jurisdictionData;
    
    if (!q || !jd) return;

    setIsLoading(prev => ({ ...prev, answer: true }));
    setError(null);
    setAnswerData(null);
    setTimelineMode(false);
    setChatHistory([]);
    setIsChatOpen(false);

    if (presetQ) setQuestion(presetQ);

    try {
      const res = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: jurisdictionData.formatted_address,
          jurisdictions: jurisdictionData.jurisdictions,
          question: q,
          targetDate: date || targetDate
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get answer');
      setAnswerData(data.answer);
      setValidationData(data.validation);
      setRawEvidence(data.evidence);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(prev => ({ ...prev, answer: false }));
    }
  };

  // 3. Compare Timeline
  const handleTimeline = async (futureDate: string) => {
    setTargetDate(futureDate);
    if (!jurisdictionData || !rawEvidence[0]?.topic) return;

    setIsLoading(prev => ({ ...prev, timeline: true }));
    setTimelineMode(true);
    
    try {
      const res = await fetch('/api/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: jurisdictionData.formatted_address,
          topic: rawEvidence[0].topic,
          dateA: new Date().toISOString(),
          dateB: new Date(futureDate).toISOString()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate timeline');
      setTimelineData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(prev => ({ ...prev, timeline: false }));
    }
  };

  // UI Components
  const EvidenceBadge = () => (
    validationData?.isFullyEvidenceBacked ? (
      <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 text-sm font-semibold rounded-full border border-green-200">
        <ShieldCheck className="w-4 h-4" /> Evidence-backed
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-50 text-yellow-700 text-sm font-semibold rounded-full border border-yellow-200">
        <AlertCircle className="w-4 h-4" /> Partially Evidence-backed
      </span>
    )
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setJurisdictionData(null); setAddress(''); setAnswerData(null); }}>
          <Scale className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-bold tracking-tight">Rental Housing Law Navigator</h1>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8">
        
        {/* Error Toast */}
        {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-4">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4"/></button>
            </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 1: HOME PAGE (Address Input) */}
        {/* ------------------------------------------------------------------ */}
        {!jurisdictionData && (
          <div className="flex flex-col items-center justify-center mt-12 md:mt-24 space-y-8 max-w-3xl mx-auto text-center animate-in fade-in zoom-in duration-500">
            <h2 className="text-4xl md:text-5xl font-bold leading-tight">
              Know the rental rules for <span className="text-blue-600">THIS address.</span>
            </h2>
            <p className="text-lg md:text-xl text-gray-600 font-light">
              Get address-specific housing-law information, backed by authoritative sources.
            </p>

            <form onSubmit={(e) => handleGeocode(e)} className="w-full relative shadow-sm hover:shadow-md transition">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400" />
              <input 
                type="text" 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter property address..."
                className="w-full pl-14 pr-36 py-5 rounded-2xl border border-gray-300 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none text-lg transition"
              />
              <button 
                type="submit"
                disabled={isLoading.geocode || !address}
                className="absolute right-2 top-2 bottom-2 px-8 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading.geocode ? <Loader2 className="h-5 w-5 animate-spin"/> : 'Search'}
              </button>
            </form>

            <div className="pt-16 w-full text-left">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Explore Example Cases</h3>
              <p className="text-gray-500 mb-8">Select a pre-built example to see how the system handles different legal scenarios.</p>
              
              {/* Featured Demo */}
              {featuredDemo && (
                <div className="mb-10 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition">
                  <div className="flex items-center gap-2 text-blue-700 font-bold uppercase tracking-widest text-xs mb-3">
                    <Star className="w-4 h-4" /> Recommended Hackathon Demo
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 mb-2">{featuredDemo.title}</h4>
                  <p className="text-sm text-gray-600 mb-4">{featuredDemo.description}</p>
                  <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="flex items-center gap-2 text-sm text-gray-700 bg-white px-3 py-1.5 rounded-lg border border-blue-100">
                      <MapPin className="w-4 h-4 text-blue-500" /> {featuredDemo.address.split(',').slice(1).join(',')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700 bg-white px-3 py-1.5 rounded-lg border border-blue-100">
                      <HelpCircle className="w-4 h-4 text-blue-500" /> "{featuredDemo.question}"
                    </div>
                  </div>
                  <button onClick={() => handleRunDemo(featuredDemo)} className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition shadow-sm flex items-center justify-center gap-2">
                    Run Full Demo Pipeline <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Filters */}
              <div className="flex flex-wrap gap-2 mb-6">
                {CATEGORIES.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => setDemoCategoryFilter(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                      demoCategoryFilter === cat 
                        ? 'bg-gray-900 text-white shadow-sm' 
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDemos.filter(d => !d.isFeatured).map(demo => (
                  <div key={demo.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition flex flex-col">
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        {demo.category}
                      </span>
                      {demo.category === 'Future Laws' && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-1 rounded">Time-Aware</span>
                      )}
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1 leading-tight">{demo.title}</h4>
                    <p className="text-xs text-gray-500 mb-4 line-clamp-2">{demo.description}</p>
                    
                    <div className="mt-auto space-y-2 mb-4">
                      <p className="text-[11px] text-gray-600 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-gray-400 shrink-0" /> <span className="truncate">{demo.address}</span>
                      </p>
                      <p className="text-[11px] text-gray-600 flex items-start gap-1.5 font-medium">
                        <HelpCircle className="w-3 h-3 text-gray-400 shrink-0 mt-0.5" /> <span className="line-clamp-2">"{demo.question}"</span>
                      </p>
                    </div>

                    <button 
                      onClick={() => handleRunDemo(demo)}
                      className="w-full py-2 bg-gray-50 border border-gray-200 text-sm font-semibold rounded-lg text-gray-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition"
                    >
                      Try Example
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-12 max-w-lg italic">
              Legal information, not legal advice. Rental laws can depend on property-specific facts and may change. This tool is intended for research purposes.
            </p>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 2: PROPERTY PAGE & QUESTION INTERFACE */}
        {/* ------------------------------------------------------------------ */}
        {jurisdictionData && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4">
            
            {/* Left Context Column */}
            <div className="lg:col-span-4 space-y-6">
              
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Property</h3>
                <div className="flex items-start gap-3">
                    <Building className="h-5 w-5 text-gray-700 mt-0.5" />
                    <div>
                        <p className="font-semibold text-gray-900 leading-tight">
                            {jurisdictionData.location.street || jurisdictionData.location.city}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                            {jurisdictionData.location.city && `${jurisdictionData.location.city}, `}
                            {jurisdictionData.location.state} {jurisdictionData.location.zip}
                        </p>
                    </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Jurisdiction</h3>
                <div className="space-y-3 relative before:absolute before:inset-y-2 before:left-[7px] before:w-0.5 before:bg-gray-100">
                    {jurisdictionData.jurisdictions.map((j: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 relative z-10">
                            <div className="w-4 h-4 rounded-full bg-white border-2 border-blue-500"></div>
                            <span className="font-medium text-gray-900 text-sm">{j.name}</span>
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold uppercase">{j.level}</span>
                        </div>
                    ))}
                </div>
              </div>

            </div>

            {/* Right Interactive Column */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Question Input */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
                <h2 className="text-2xl font-bold mb-6">What would you like to know?</h2>
                
                <form onSubmit={(e) => handleAsk(e)} className="relative mb-8">
                    <input 
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Type your question..."
                        className="w-full pl-5 pr-14 py-4 rounded-xl border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg transition"
                    />
                    <button 
                        type="submit"
                        disabled={isLoading.answer || !question}
                        className="absolute right-2 top-2 bottom-2 px-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center"
                    >
                        {isLoading.answer ? <Loader2 className="h-5 w-5 animate-spin"/> : <ArrowRight className="h-5 w-5" />}
                    </button>
                </form>

                {!answerData && !isLoading.answer && (
                    <div>
                        <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Questions you can ask</p>
                        <div className="flex flex-col gap-2">
                            {getSuggestedQuestions().map((q, i) => (
                                <button 
                                    key={i}
                                    onClick={() => handleAsk(undefined, q)}
                                    className="text-left px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium hover:border-blue-300 hover:bg-blue-50 transition text-gray-700 flex items-center justify-between group"
                                >
                                    {q}
                                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                {isLoading.answer && (
                    <div className="py-12 flex flex-col items-center justify-center text-gray-500 space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <p className="font-medium animate-pulse">Researching authoritative sources...</p>
                    </div>
                )}
              </div>

              {/* ------------------------------------------------------------------ */}
              {/* VIEW 3: ANSWER PAGE */}
              {/* ------------------------------------------------------------------ */}
              {answerData && !isLoading.answer && !timelineMode && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-4">
                  
                  {/* Short Answer Header */}
                  <div className="p-6 md:p-8 bg-blue-50/50 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Short Answer</h3>
                        <EvidenceBadge />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
                        {answerData.shortAnswer}
                    </h2>
                  </div>

                  {/* Body Content */}
                  <div className="p-6 md:p-8 space-y-8">
                    
                    <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">What Applies to this Property?</h3>
                        <p className="font-medium text-gray-900">
                            {answerData.applicableJurisdictions.join(' • ')} rules apply.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Explanation</h3>
                        <p className="text-gray-700 leading-relaxed">{answerData.explanation}</p>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Scale className="h-4 w-4" /> Evidence & Citations
                        </h3>
                        
                        {answerData.claims.length > 0 ? (
                            <div className="space-y-4">
                                {answerData.claims.map((claim: any, idx: number) => (
                                    <div key={idx} className={`p-4 rounded-xl border ${claim.isValid ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'}`}>
                                        <p className={`font-medium mb-3 ${claim.isValid ? 'text-gray-900' : 'text-red-900 line-through opacity-75'}`}>
                                            "{claim.text}"
                                        </p>
                                        
                                        {!claim.isValid && (
                                            <p className="text-xs font-bold text-red-600 mb-2 uppercase">⚠️ {claim.validationReason}</p>
                                        )}

                                        <div className="flex flex-wrap gap-2">
                                            {claim.citations.map((citeId: string) => {
                                                const doc = rawEvidence.find(e => e.documentId === citeId);
                                                if (!doc) return null;
                                                return (
                                                    <button 
                                                        key={citeId}
                                                        onClick={() => setSelectedEvidence(doc)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:border-blue-500 hover:text-blue-700 transition shadow-sm"
                                                    >
                                                        <FileText className="w-3 h-3" />
                                                        {doc.title.split('-')[0].trim()}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 italic">No specific claims were generated.</p>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-gray-100">
                        <div>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Confidence</h3>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                    answerData.confidence === 'High' ? 'bg-green-500' :
                                    answerData.confidence === 'Medium' ? 'bg-yellow-500' : 'bg-red-500'
                                }`}></div>
                                <span className="font-semibold text-gray-700">{answerData.confidence} Confidence</span>
                            </div>
                        </div>
                        {answerData.limitations && (
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Limitations</h3>
                                <p className="text-sm text-gray-600">{answerData.limitations}</p>
                            </div>
                        )}
                    </div>
                    
                    {/* Ask Follow-ups Button */}
                    <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center">
                        <button 
                            onClick={() => setIsChatOpen(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-50 text-blue-700 font-semibold rounded-xl hover:bg-blue-100 transition"
                        >
                            <HelpCircle className="w-5 h-5" />
                            Ask follow-ups about this result
                        </button>
                    </div>

                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------------ */}
              {/* VIEW 4: FUTURE CHANGES / TIMELINE */}
              {/* ------------------------------------------------------------------ */}
              {answerData && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div>
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <CalendarClock className="h-6 w-6 text-purple-500" />
                                How could this change?
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">See how the rules might change on a future date.</p>
                        </div>
                        <div className="flex bg-gray-100 p-1 rounded-xl">
                            <button 
                                onClick={() => { setTimelineMode(false); setTimelineData(null); }}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${!timelineMode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                                Today
                            </button>
                            <button 
                                onClick={() => handleTimeline('2027-01-01')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${timelineMode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                                Future Date
                            </button>
                        </div>
                    </div>

                    {isLoading.timeline && (
                        <div className="py-8 flex flex-col items-center justify-center text-gray-500">
                            <Activity className="h-6 w-6 animate-pulse text-purple-500 mb-2" />
                            <p className="text-sm font-medium">Computing temporal diff...</p>
                        </div>
                    )}

                    {timelineMode && timelineData && (
                        <div className="animate-in fade-in slide-in-from-bottom-4">
                            <div className="bg-purple-50 text-purple-900 p-4 rounded-xl mb-6 font-medium text-sm">
                                {timelineData.explanation}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* CURRENT */}
                                <div className="border border-gray-200 rounded-xl overflow-hidden opacity-75">
                                    <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 font-bold text-xs uppercase tracking-wider text-gray-500">
                                        Current
                                    </div>
                                    <div className="p-4 space-y-4">
                                        {timelineData.rulesOnDateA.map((d: any) => (
                                            <div key={d.id}>
                                                <p className="font-semibold text-sm mb-1">{d.title}</p>
                                                <p className="text-xs text-gray-500 line-clamp-3">{d.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* FUTURE */}
                                <div className="border border-purple-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-purple-100 px-4 py-2 border-b border-purple-200 font-bold text-xs uppercase tracking-wider text-purple-700">
                                        Future (2027)
                                    </div>
                                    <div className="p-4 space-y-4">
                                        {timelineData.rulesOnDateB.map((d: any) => (
                                            <div key={d.id}>
                                                <p className="font-semibold text-sm mb-1">{d.title}</p>
                                                <p className="text-xs text-gray-600 line-clamp-3">{d.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
              )}

            </div>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* EVIDENCE DRAWER */}
      {/* ------------------------------------------------------------------ */}
      {selectedEvidence && (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setSelectedEvidence(null)}></div>
            <div className="w-full max-w-lg h-full bg-white shadow-2xl flex flex-col relative z-10 animate-in slide-in-from-right duration-300">
                
                <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-bold flex items-center gap-2">
                        <Scale className="h-5 w-5 text-blue-600" /> Source Evidence
                    </h3>
                    <button onClick={() => setSelectedEvidence(null)} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-200 rounded-full transition">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1 space-y-8">
                    <div>
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Document Title</h4>
                        <p className="font-semibold text-gray-900 text-lg leading-tight">{selectedEvidence.title}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div>
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Jurisdiction</h4>
                            <p className="font-medium text-gray-900 text-sm">{selectedEvidence.jurisdiction}</p>
                        </div>
                        <div>
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Status</h4>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                                selectedEvidence.status === 'CURRENT' ? 'bg-green-100 text-green-700' :
                                selectedEvidence.status === 'FUTURE' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-700'
                            }`}>
                                {selectedEvidence.status}
                            </span>
                        </div>
                        <div className="col-span-2">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Applicable Dates</h4>
                            <p className="text-sm text-gray-700 font-mono">
                                {new Date(selectedEvidence.effectiveFrom).toISOString().split('T')[0]} 
                                <span className="mx-2 text-gray-300">→</span> 
                                {selectedEvidence.effectiveUntil ? new Date(selectedEvidence.effectiveUntil).toISOString().split('T')[0] : 'Present'}
                            </p>
                        </div>
                    </div>
                    
                    <div>
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Relevant Legal Passage</h4>
                        <div className="bg-amber-50/50 border-l-4 border-amber-300 p-5 text-gray-800 font-serif leading-relaxed text-[15px] rounded-r-xl max-h-[400px] overflow-y-auto whitespace-pre-wrap">
                            {selectedEvidence.snapshot_text ? (
                                (() => {
                                    const text = selectedEvidence.snapshot_text;
                                    const snippet = selectedEvidence.relevantText;
                                    const idx = text.indexOf(snippet);
                                    if (idx === -1) return text;
                                    return (
                                        <>
                                            {text.substring(0, idx)}
                                            <mark className="bg-yellow-200">{snippet}</mark>
                                            {text.substring(idx + snippet.length)}
                                        </>
                                    );
                                })()
                            ) : (
                                selectedEvidence.relevantText
                            )}
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        <a 
                            href={selectedEvidence.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer" 
                            onClick={() => fetchUrlHealth(selectedEvidence.sourceUrl)}
                            className="flex items-center justify-center gap-2 w-full py-4 px-4 border-2 border-gray-200 text-sm font-bold uppercase tracking-widest rounded-xl text-gray-600 hover:border-gray-900 hover:text-gray-900 hover:bg-gray-50 transition"
                        >
                            Open Original Source <ExternalLink className="h-4 w-4" />
                        </a>
                        {sourceHealth === false && (
                            <p className="text-xs text-amber-600 text-center font-medium bg-amber-50 p-2 rounded">
                                The authoritative source is currently unavailable. Showing the saved copy retrieved on {selectedEvidence.retrieved_at ? format(new Date(selectedEvidence.retrieved_at), 'MMM d, yyyy') : 'an earlier date'}.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Chat Panel */}
      {isChatOpen && (
          <div className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col transform transition-transform">
              <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
                  <div>
                      <h2 className="font-bold text-gray-900">Ask Follow-ups</h2>
                      <p className="text-xs text-gray-500">Legal information grounded in {jurisdictionData?.jurisdictions?.[0]?.name} law</p>
                  </div>
                  <button onClick={() => setIsChatOpen(false)} className="p-2 bg-gray-200 hover:bg-gray-300 rounded-full transition">
                      <X className="h-4 w-4 text-gray-700" />
                  </button>
              </div>

              <div className="p-3 border-b border-gray-100 flex gap-2 overflow-x-auto">
                  {['Normal', 'Explain like I am 12', 'Summarize for my landlord'].map(t => (
                      <button 
                          key={t}
                          onClick={() => setChatTone(t)}
                          className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition ${chatTone === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                          {t}
                      </button>
                  ))}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatHistory.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>
                              {msg.role === 'assistant' ? (
                                  msg.content.split(/(\[doc_[a-zA-Z0-9-]+\])/).map((part, i) => {
                                      const match = part.match(/\[(doc_[a-zA-Z0-9-]+)\]/);
                                      if (match) {
                                          const docId = match[1];
                                          const doc = rawEvidence.find(e => e.documentId === docId);
                                          return (
                                              <button 
                                                  key={i} 
                                                  onClick={() => doc && setSelectedEvidence(doc)}
                                                  className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 mx-1 bg-blue-100 text-blue-700 rounded border border-blue-200 hover:bg-blue-200 uppercase tracking-wide transition align-middle"
                                              >
                                                  {doc ? 'Source' : 'Source'}
                                              </button>
                                          );
                                      }
                                      return <span key={i}>{part}</span>;
                                  })
                              ) : (
                                  msg.content
                              )}
                          </div>
                      </div>
                  ))}
                  {isChatLoading && (
                      <div className="flex justify-start">
                          <div className="bg-gray-100 p-3 rounded-2xl rounded-bl-none"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
                      </div>
                  )}
              </div>

              <form onSubmit={handleChatSubmit} className="p-4 border-t border-gray-200 bg-white">
                  <div className="flex gap-2">
                      <input 
                          type="text"
                          value={currentChatInput}
                          onChange={(e) => setCurrentChatInput(e.target.value)}
                          placeholder="Ask a follow-up..."
                          className="flex-1 border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm text-gray-900"
                      />
                      <button type="submit" disabled={!currentChatInput.trim() || isChatLoading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl transition">
                          <ArrowRight className="w-5 h-5" />
                      </button>
                  </div>
                  <p className="text-center text-[10px] text-gray-400 mt-2">Legal information, not legal advice.</p>
              </form>
          </div>
      )}
    </div>
  );
}
