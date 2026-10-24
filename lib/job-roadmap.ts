import { createPlan, synthesizeCurriculumIfMissing, type Plan } from './domain';

/** Keep the existing curriculum view and explicit lesson-to-milestone IDs. */
export function createJobRoadmap(
  id: string,
  title: string,
  skills: string[],
  hours = 5,
): Plan {
  const baseline = createPlan(title.slice(0, 100), [], hours);
  const milestones = skills.flatMap((skill) => {
    const step = createPlan(title.slice(0, 100), [skill], hours).milestones[0];
    return [
      'Foundations and guided study',
      'Practice and application',
      'Project and self-assessment',
    ].map((stage, index) => ({
      ...step,
      id: crypto.randomUUID(),
      title: `${skill}: ${stage}`,
      practice:
        index === 0
          ? `Work through the linked learning material for ${skill}; explain the core concepts before moving on.`
          : step.practice,
      proveSkill: index === 2 ? step.proveSkill : '',
      state: 'Not started' as const,
      done: false,
    }));
  });
  const plan = synthesizeCurriculumIfMissing({ ...baseline, id, milestones });
  const lessons = (plan.modules || [])
    .flatMap((module) => module.lessons)
    .map((lesson) => ({
      ...lesson,
      resources: lesson.resources.map((resource) => ({
        ...resource,
        verified: false,
      })),
    }));
  const modules = [];
  const groupSize = Math.max(9, Math.ceil(skills.length / 30) * 3);
  for (let offset = 0; offset < lessons.length; offset += groupSize) {
    const group = lessons.slice(offset, offset + groupSize);
    modules.push({
      id: `job-module-${offset / groupSize + 1}`,
      title:
        `Learning sequence ${offset / groupSize + 1}: ${skills.slice(offset / 3, offset / 3 + groupSize / 3).join(', ')}`.slice(
          0,
          250,
        ),
      description:
        'Study each missing skill, apply it in practice, then complete its project and self-assessment.',
      learningObjectives: group.map((lesson) => lesson.learningObjective),
      estimatedDuration: `${group.length * 4} hours`,
      prerequisites: [],
      lessons: group,
    });
  }
  return {
    ...plan,
    modules,
    source: 'deterministic',
    assessment: {
      whatYouWillLearn: skills.length
        ? `Prepare the missing technical skills: ${skills.join(', ')}.`
        : 'No identified technical skill gaps remain.',
      whyIncluded: 'Based on the saved job and current account skill evidence.',
      expectedSequence:
        'Study, guided practice, then project and self-assessment for each missing skill.',
      estimatedTotalDuration: `${milestones.length * 4} hours; approximately ${Math.ceil((milestones.length * 4) / hours)} weeks at ${hours} hours/week`,
      majorMilestones: milestones.map((m) => m.title).slice(0, 30),
      skillGapsIdentified: skills,
      providerNotice:
        'Existing learning resources; completion is self-reported, not an independently verified assessment.',
    },
  };
}

/** Exact links prevent module completion from crediting an unrelated skill. */
export function linkedLessonProgress(
  milestone: Plan['milestones'][number],
  modules: NonNullable<Plan['modules']>,
) {
  const lesson = modules
    .flatMap((module) => module.lessons)
    .find((item) => item.id === `syn-les-${milestone.id}`);
  return lesson
    ? {
        ...milestone,
        done: Boolean(lesson.done),
        state: lesson.done
          ? ('Demonstrated' as const)
          : milestone.done || milestone.state === 'Demonstrated'
            ? ('Learning' as const)
            : milestone.state,
      }
    : null;
}
