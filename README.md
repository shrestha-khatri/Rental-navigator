# Rental Housing Law Navigator

Rental-housing laws are deeply fragmented across multiple levels of government (State, County, City) and constantly shifting across time. The **Rental Housing Law Navigator** solves this by turning fragmented legal information into an accessible, address-specific, evidence-grounded answer.

Built for the **Global AI Hackathon 2026** (Problem Statement 2).

## Features
- **Address-First Resolution:** Accurately determines overlapping legal jurisdictions (State, County, City) from a single address.
- **Strict Temporal Reasoning:** Mathematically isolates active, repealed, pending, and future laws based on a specific target date.
- **Zero-Hallucination RAG Pipeline:** LLM responses are intercepted by a Citation Validation engine that cross-checks every generated claim against the raw database text.
- **Evidence Drawer:** Complete transparency. Users can click any citation to view the exact legal statute and jump to the official government source.

## Architecture
Please see [ARCHITECTURE.md](./ARCHITECTURE.md) for a detailed technical breakdown of the retrieval pipeline, AI engine, and Citation Firewall.

## Setup & Installation

**Prerequisites:** Node.js (v18+)

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   Add your Gemini API Key to `.env`. (If missing, the app degrades gracefully into a deterministic Demo Mode).

3. **Database Setup:**
   The MVP uses SQLite. Push the schema and seed the curated demo data (CA & SF laws):
   ```bash
   npx prisma db push --accept-data-loss
   npx prisma db seed
   ```

4. **Run the Application:**
   ```bash
   npm run dev
   ```
   Navigate to `http://localhost:3000`.

## Hackathon Demo Mode
To ensure a flawless presentation for judges, click **"Try San Francisco Demo"** on the homepage. This activates bypasses for rate-limited geocoding APIs and provides a perfectly curated demonstration of jurisdiction resolution, evidence-backed QA, and future-law temporal diffing. See [DEMO.md](./DEMO.md) for the 90-second script.

## Limitations & Future Work
- **Data Scaling:** The MVP database is seeded manually with a tiny subset of verified California and San Francisco laws to prove the architecture. A production rollout requires automated ingestion pipelines parsing municipal code APIs.
- **LLM-as-a-Judge:** The Citation Validation engine currently uses a strict deterministic + lightweight semantic heuristic if the API fails. Advanced production validation requires recursive LLM-as-a-judge patterns.
