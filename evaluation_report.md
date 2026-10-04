# Rental Housing Law Navigator - Evaluation Report
Date: 2026-10-04T09:11:55.632Z

## 1. Automated Metrics
- Address Resolution Accuracy: 4/4
- Jurisdiction Accuracy: 4/4
- Retrieval Relevance: 3/4
- Temporal Filtering Accuracy: 3/4
- Citation Coverage (Avg): 100.00%
- Total Claims Generated: 3
- Unsupported Claim Count: 0

## 2. Limitations
* Automated assessment of "Answer Groundedness" is limited because validating if an LLM truly accurately translated a legal text (without nuance loss) requires human legal review or a highly advanced specialized LLM judge (LLM-as-a-judge). Currently, we use deterministic existence checks and basic NLI logic.
* The test dataset is small and heavily localized to CA/SF. Nationwide scale testing would require a massive matrix of local municipal codes.