# Post-V0.6 Deferred Work

## Purpose

This document records product ideas intentionally excluded from V0.6. It is not a release plan or a promise of future implementation. Real personal job-search use remains the source of truth.

Product direction remains `Search → Review → Tailor → Apply`.

Core principles remain local-only, single-user, Germany-focused, deterministic runtime, no runtime LLM, human-owned decisions, no auto-submit, private local data, and small practical changes.

## Decision rule

Before beginning any post-V0.6 feature, require evidence of at least one of:

1. Repeated missed relevant jobs.
2. Repeated irrelevant jobs reaching Review.
3. Repeated manual work that materially interrupts normal job searching.
4. Inability to track an important real application state.
5. Recurring document-quality problems affecting real applications.
6. Recurring maintenance or reliability problems.
7. A workflow blocker observed in actual use.

Do not implement something merely because another product has it, an API exists, it is technically interesting, it saves occasional clicks, it appeared on an old roadmap, or it makes the product appear more complete.

## A. Discovery expansion

### Additional ATS providers

Possible providers include Workday, SmartRecruiters, SuccessFactors, Softgarden, Ashby, Recruitee, and other Germany-relevant ATS platforms. Reconsider only when real searching repeatedly misses relevant jobs from a specific provider. Do not create a generic ATS framework; add an individual provider only when evidence supports it.

### Broader Personio discovery

Tenant inference, employer-to-Personio discovery, and automatic Personio-source discovery remain deferred. Explicit configured public sources remain sufficient unless they become a repeated practical burden.

### Generic employer crawling

Do not implement generic crawling. Reconsider only if important official-source resolution repeatedly fails and a bounded deterministic alternative can solve it reliably.

## B. Search and relevance intelligence

### Scoring redesign

Richer weighting, configurable models, calibration, or multiple scores are deferred unless the current score repeatedly causes poor Review ordering or wastes material human review time.

### Embeddings, ML, or runtime LLM classification

Do not implement. The product intentionally uses deterministic local behavior. Reconsidering this is a product-direction decision, not a routine upgrade.

### Complex role-family, geography, or work-authorisation logic

Occupation taxonomies, semantic title hierarchies, geocoding, commuting distances, visa/citizenship inference, and country-by-country work-authorisation policy remain deferred. Reconsider only after documented recurring failures in Germany-focused usage. Ambiguous legal eligibility remains for human review.

## C. Job lifecycle intelligence

Repost detection, automatic expiry/stale-post handling, periodic official-URL revalidation, and company watchlists remain deferred. Reconsider them only when repeated reposts, stale listings, or a target-company workflow materially disrupt normal use.

## D. Tailoring and documents

More advanced deterministic CV tailoring, CV visual redesign, document editing, version-management UI, notes/CRM, reminders, email/calendar integrations, automatic form filling, and application submission automation remain out of scope. Reconsider only when real use documents a recurring problem that cannot be handled through the existing workflow or a simple manual step.
