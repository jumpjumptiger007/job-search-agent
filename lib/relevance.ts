export type ProfileExperience = {
  employer: string;
  title: string;
  dates?: string;
  bullets?: string[];
};

export type TailoringProfile = {
  skills?: string[];
  experience?: ProfileExperience[];
};

const stopWords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "of", "on", "or", "the", "to", "with",
]);

function terms(text: string) {
  return new Set((text.toLowerCase().match(/[a-z0-9+#]+/g) || []).filter((term) => term.length > 1 && !stopWords.has(term)));
}

function normalized(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim();
}

function relevanceScore(fact: string, jdTerms: Set<string>, jd: string) {
  const factTerms = terms(fact);
  const matches = [...factTerms].filter((term) => jdTerms.has(term)).length;
  return matches + (normalized(fact).length > 1 && normalized(jd).includes(normalized(fact)) ? 100 : 0);
}

function rankFacts(facts: string[] | undefined, jd: string) {
  const jdTerms = terms(jd);
  return (facts || [])
    .map((fact, index) => ({ fact, index, score: relevanceScore(fact, jdTerms, jd) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ fact }) => fact);
}

export function rankProfileRelevance(profile: TailoringProfile, jd: string) {
  return {
    skills: rankFacts(profile.skills, jd),
    experience: (profile.experience || []).map((experience) => ({
      ...experience,
      bullets: rankFacts(experience.bullets, jd),
    })),
  };
}
