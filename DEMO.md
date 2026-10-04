# Rental Housing Law Navigator - 90-Second Demo Script

**Goal:** Prove to the judges that we solved fragmented legal discovery through strict geographic, temporal, and evidence-backed RAG.

## Setup (0:00 - 0:05)
*   **Action:** Have the application open to `localhost:3000`. 
*   **Speaker:** "Rental laws depend entirely on *where* you live and *when* you ask. Today, finding out if your landlord can raise your rent means digging through state, county, and city codes. We built the Rental Housing Law Navigator to fix this."

## Step 1: Address First (0:05 - 0:20)
*   **Action:** Click the **"Try San Francisco Demo"** button on the homepage.
*   **Speaker:** "We start with the address. Behind the scenes, we don't just geocode the coordinates; we resolve the exact overlapping legal jurisdictions. Notice on the left: this property is bound by California (State), San Francisco County, and San Francisco (City)."

## Step 2: Evidence-Backed QA (0:20 - 0:50)
*   **Action:** Click the suggested question: *"Can my landlord raise my rent?"*
*   **Speaker:** "Let's ask about rent control. Our RAG pipeline doesn't just do semantic search. It hard-filters by those exact jurisdictions and strictly enforces authority ranking. The AI tells us 'Yes, but it's capped', and notice the green **Evidence-backed** badge. 
*   **Action:** Scroll to the Evidence & Citations section. Click the citation badge (`37.3`).
*   **Speaker:** "Our Citation Validation engine intercepted the AI's response and proved every claim against the raw text. Click the citation, and our Evidence Drawer pulls up the exact San Francisco Administrative Code. We never hallucinate the law."

## Step 3: Temporal Reasoning / Future Laws (0:50 - 1:15)
*   **Action:** Scroll down to "How could this change?" and click **[ Future Date (2027) ]**.
*   **Speaker:** "But the law changes. What happens if new legislation passes? Our Temporal Engine mathematically diffs the legal state of *Today* against *2027*. It instantly isolates the current AB 1482 cap, detects a newly enacted hypothetical 'SB X' taking effect in 2027, and explicitly shows that 1 provision will be amended. It even isolates pending bills so they are never confused with active laws."

## Conclusion (1:15 - 1:30)
*   **Action:** Close the drawer, return to Home.
*   **Speaker:** "Address-first. Mathematically verified timelines. 100% evidence-grounded AI. This is the future of legal access. Thank you."
