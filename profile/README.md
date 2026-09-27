# Candidate setup (private)

Create `profile.yaml` here using your own factual information. The application reads `profile/profile.yaml` as the candidate source of truth for job analysis and generated materials. PDF and DOCX CV files are not parsed or imported; putting a CV in this directory does not configure your profile. Enter the relevant facts in `profile.yaml`.

Generated materials may select and rephrase profile facts, but must not invent candidate facts. At minimum, `profile.yaml` needs a factual `name`. Supported factual fields include `email`, `phone`, `location`, `summary`, `skills`, `competencies`, `experience` (employer, title, optional dates and bullets), `education`, and `languages`.

This file is private and ignored by Git. Discovery preferences and provider configuration belong in the separate private files `config/preferences.yaml` and `config/search.yaml`.
