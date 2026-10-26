import { jobSkills } from './job-skills';
import { skillNames } from './catalogue';
import { analyseJob } from './domain';
import type { learningEvidence } from './learning-memory';
export function accountJobAnalysis(
  text: string,
  memory: ReturnType<typeof learningEvidence>,
) {
  const sentences = text.split(/\n|[.;](?:\s|$)/).filter(Boolean);
  const completed = new Set(memory.learnedSkills.map((s) => s.toLowerCase()));
  const reported = new Set(memory.skills.map((s) => s.toLowerCase()));
  const inferred = new Set(memory.inferredSkills.map((s) => s.toLowerCase()));
  const requirements = [...new Set([...jobSkills, ...skillNames])].flatMap(
    (skill) => {
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i');
      const lines = sentences.filter(
        (line) =>
          re.test(line) &&
          !new RegExp(
            `(?:no|without|not requiring)\\s+(?:prior\\s+)?${escaped}|${escaped}\\s+(?:experience\\s+)?(?:is\\s+)?not required`,
            'i',
          ).test(line),
      );
      if (!lines.length) return [];
      const optional = lines.every((line) =>
        /preferred|optional|nice.to.have|bonus/i.test(line),
      );
      const key = skill.toLowerCase();
      return [
        {
          skill,
          optional,
          evidence: lines[0].trim().slice(0, 400),
          status: completed.has(key)
            ? 'Completed (self-reported)'
            : reported.has(key)
              ? 'Self-reported'
              : inferred.has(key)
                ? 'CV-inferred; confirm'
                : 'Not yet demonstrated',
        },
      ];
    },
  );
  const matched = requirements.filter(
    (r) =>
      r.status === 'Completed (self-reported)' || r.status === 'Self-reported',
  );
  const weight = (r: (typeof requirements)[number]) => (r.optional ? 1 : 2);
  const total = requirements.reduce((sum, r) => sum + weight(r), 0);
  return {
    requirements,
    detectedSkills: requirements.map((r) => r.skill),
    matchedSkills: matched.map((r) => r.skill),
    missingSkills: requirements
      .filter((r) => !matched.includes(r))
      .map((r) => r.skill),
    matchPercent: total
      ? Math.round(
          (matched.reduce((sum, r) => sum + weight(r), 0) / total) * 100,
        )
      : null,
    skillCoverage: requirements.length
      ? Math.round((matched.length / requirements.length) * 100)
      : null,
    overallJobMatch: null,
    formal: analyseJob(text, []).formal,
    method:
      'Required skills count twice; preferred skills once. Self-reported completion and profile claims count toward coverage; CV-inferred and in-progress skills require confirmation. Experience and qualifications need separate review. This is not a hiring probability.',
    serverLearnedSkills: memory.learnedSkills,
  };
}
