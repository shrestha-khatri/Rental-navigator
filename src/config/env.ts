// Centralized environment variable handling

export const config = {
  // Database
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  
  // AI / LLM Provider
  llmProvider: process.env.LLM_PROVIDER || 'gemini',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  
  // Geocoding
  geocodingProvider: process.env.GEOCODING_PROVIDER || 'google',
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  mapboxApiKey: process.env.MAPBOX_API_KEY || '',
  
  // Search / Vector DB
  vectorDbProvider: process.env.VECTOR_DB_PROVIDER || 'local',
  pineconeApiKey: process.env.PINECONE_API_KEY || '',
  
  // App Config
  isProduction: process.env.NODE_ENV === 'production',
};

// Validate required keys on startup (if necessary)
export function validateEnv() {
  const missing: string[] = [];
  
  // Add strict checks when moving beyond MVP
  // if (!config.geminiApiKey && config.llmProvider === 'gemini') missing.push('GEMINI_API_KEY');
  
  if (missing.length > 0) {
    console.warn(`⚠️ Missing recommended environment variables: ${missing.join(', ')}`);
  }
}
