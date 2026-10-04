# System Architecture

The Rental Housing Law Navigator is built on a modular, defensively-engineered architecture designed to strictly prevent LLM hallucinations and enforce spatial/temporal legal bounds.

## High-Level Pipeline

\`\`\`mermaid
flowchart TD
    UI[Frontend UI] -->|Address| JRes[Jurisdiction Resolver]
    JRes -->|State/County/City| UI
    UI -->|Question + Date + Jurisdictions| API[/api/answer]
    API --> Ret[Retrieval Engine]
    Ret -->|Geographic/Temporal Filtering| DB[(SQLite/Prisma)]
    DB -->|Authoritative Legal Texts| Ret
    Ret --> AI[AI Answer Engine]
    AI -->|Raw LLM Output| CV[Citation Validation Engine]
    CV -->|Cross-checks claims vs text| API
    API -->|Strict JSON + Evidence| UI
\`\`\`

## Core Modules

### 1. Jurisdiction Resolver (\`src/services/jurisdiction\`)
Translates raw strings into geographic coordinates (via OpenStreetMap/Nominatim) and derives overlapping legal bounds (State -> County -> City). Includes deterministic fallbacks for reliable live demos.

### 2. Retrieval Engine (\`src/services/retrieval\`)
A strict, rule-based filtering layer. It does *not* rely purely on vector similarity. It first applies hard filters:
*   **Geographic Bound:** Must match the resolved jurisdictions.
*   **Temporal Bound:** `effectiveFrom <= Target Date <= effectiveUntil`.
*   **Authority Ranking:** Ranks `PRIMARY` sources and prioritizes local City law over State law in conflicts.

### 3. Temporal Engine (\`src/services/temporal\`)
Performs time-aware legal reasoning. It isolates `CURRENT`, `REPEALED`, `FUTURE`, and `PENDING` states. Its primary function (`compareLegalState`) performs a mathematical diff between two dates to calculate `provisionsIntroduced`, `provisionsRemoved`, and `provisionsChanged`.

### 4. AI Answer Engine (\`src/services/ai\`)
Leverages Gemini 2.5 Flash via a highly constrained system prompt. It outputs strict JSON enforcing a schema of `claims` and `citations`. It is actively prevented from using general pre-trained knowledge.

### 5. Citation Validation Engine (\`src/services/citation\`)
The "Hallucination Firewall". It intercepts the LLM's payload before returning to the user. For every `claim`, it:
1. Verifies the cited Document ID exists.
2. Evaluates the target date.
3. Performs an NLI (Natural Language Inference) check to guarantee the raw legal text actually substantiates the claim.

### 6. Database Layer (Prisma)
Structured to handle complex legal metadata: Topic taxonomies, effective dates, and authority levels. 
*See \`prisma/schema.prisma\` for exact model definitions.*
