import {
  PROFILE_VERSION,
  type InterviewKnowledge,
  type InterviewStory,
  type Profile,
  type ProfileStory,
  type ProfileWorkExperience,
} from "../../data/profile";

export const PROFILE_DOCUMENT_ID = "primary";
export const PROFILE_DOCUMENT_MAX_CHARS = 120_000;

export class ProfileValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues[0] ?? "Profile 格式不正確");
    this.name = "ProfileValidationError";
  }
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProfileValidationError([`${path} 必須是物件`]);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string, max = 100): unknown[] {
  if (!Array.isArray(value)) throw new ProfileValidationError([`${path} 必須是陣列`]);
  if (value.length > max) throw new ProfileValidationError([`${path} 最多 ${max} 筆`]);
  return value;
}

function asString(value: unknown, path: string, max = 8_000): string {
  if (typeof value !== "string") throw new ProfileValidationError([`${path} 必須是文字`]);
  const text = value.trim();
  if (text.length > max) throw new ProfileValidationError([`${path} 最多 ${max} 字`]);
  return text;
}

function asRequiredString(value: unknown, path: string, max = 2_000): string {
  const text = asString(value, path, max);
  if (!text) throw new ProfileValidationError([`${path} 不可空白`]);
  return text;
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ProfileValidationError([`${path} 必須是非負數字`]);
  }
  return value;
}

function asStringArray(value: unknown, path: string, max = 100): string[] {
  return asArray(value, path, max).map((item, index) => asString(item, `${path}[${index}]`, 2_000));
}

function parseStory(value: unknown, path: string): ProfileStory {
  const item = asRecord(value, path);
  return {
    situation: asString(item.situation, `${path}.situation`),
    action: asString(item.action, `${path}.action`),
    result: asString(item.result, `${path}.result`),
  };
}

function parseWorkExperience(value: unknown, index: number): ProfileWorkExperience {
  const path = `workExperience[${index}]`;
  const item = asRecord(value, path);
  const stories = asRecord(item.stories, `${path}.stories`);
  const links = item.links === undefined
    ? undefined
    : asArray(item.links, `${path}.links`, 30).map((link, linkIndex) => {
        const parsed = asRecord(link, `${path}.links[${linkIndex}]`);
        return {
          label: asRequiredString(parsed.label, `${path}.links[${linkIndex}].label`, 200),
          url: asRequiredString(parsed.url, `${path}.links[${linkIndex}].url`, 2_000),
          ...(typeof parsed.external === "boolean" ? { external: parsed.external } : {}),
        };
      });

  return {
    id: asRequiredString(item.id, `${path}.id`, 100),
    role: asRequiredString(item.role, `${path}.role`, 300),
    company: asRequiredString(item.company, `${path}.company`, 500),
    location: asString(item.location, `${path}.location`, 300),
    period: asRequiredString(item.period, `${path}.period`, 200),
    displayYear: asRequiredString(item.displayYear, `${path}.displayYear`, 20),
    distance: asString(item.distance, `${path}.distance`, 300),
    vibe: asString(item.vibe, `${path}.vibe`, 2_000),
    summary: asRequiredString(item.summary, `${path}.summary`, 3_000),
    highlights: asStringArray(item.highlights, `${path}.highlights`),
    details: asStringArray(item.details, `${path}.details`),
    stories: {
      ...(stories.rhythm === undefined ? {} : { rhythm: asString(stories.rhythm, `${path}.stories.rhythm`) }),
      cases: asArray(stories.cases, `${path}.stories.cases`, 50).map((story, storyIndex) =>
        parseStory(story, `${path}.stories.cases[${storyIndex}]`),
      ),
    },
    tags: asStringArray(item.tags, `${path}.tags`, 50),
    blogSlug: asString(item.blogSlug, `${path}.blogSlug`, 300),
    ...(links ? { links } : {}),
  };
}

function parseInterviewStory(value: unknown, index: number): InterviewStory {
  const path = `interviewKnowledge.stories[${index}]`;
  const item = asRecord(value, path);
  const visibility = asRequiredString(item.visibility, `${path}.visibility`, 20);
  if (visibility !== "public" && visibility !== "private") {
    throw new ProfileValidationError([`${path}.visibility 必須是 public 或 private`]);
  }
  return {
    id: asRequiredString(item.id, `${path}.id`, 100),
    title: asRequiredString(item.title, `${path}.title`, 300),
    situation: asString(item.situation, `${path}.situation`),
    task: asString(item.task, `${path}.task`),
    action: asString(item.action, `${path}.action`),
    result: asString(item.result, `${path}.result`),
    reflection: asString(item.reflection, `${path}.reflection`),
    visibility,
  };
}

function parseInterviewKnowledge(value: unknown): InterviewKnowledge {
  const item = asRecord(value, "interviewKnowledge");
  const career = asRecord(item.careerNarrative, "interviewKnowledge.careerNarrative");
  const assessment = asRecord(item.selfAssessment, "interviewKnowledge.selfAssessment");
  const views = asRecord(item.professionalViews, "interviewKnowledge.professionalViews");
  return {
    careerNarrative: {
      shortIntroduction: asString(career.shortIntroduction, "interviewKnowledge.careerNarrative.shortIntroduction"),
      careerTransition: asString(career.careerTransition, "interviewKnowledge.careerNarrative.careerTransition"),
      nextRoleMotivation: asString(career.nextRoleMotivation, "interviewKnowledge.careerNarrative.nextRoleMotivation"),
    },
    selfAssessment: {
      strengths: asStringArray(assessment.strengths, "interviewKnowledge.selfAssessment.strengths", 20),
      improvementArea: asString(assessment.improvementArea, "interviewKnowledge.selfAssessment.improvementArea"),
      workingStyle: asString(assessment.workingStyle, "interviewKnowledge.selfAssessment.workingStyle"),
    },
    professionalViews: {
      customerSuccess: asString(views.customerSuccess, "interviewKnowledge.professionalViews.customerSuccess"),
      aiAndRag: asString(views.aiAndRag, "interviewKnowledge.professionalViews.aiAndRag"),
      knowledgeManagement: asString(views.knowledgeManagement, "interviewKnowledge.professionalViews.knowledgeManagement"),
    },
    stories: asArray(item.stories, "interviewKnowledge.stories", 80).map(parseInterviewStory),
    publicNotes: asStringArray(item.publicNotes, "interviewKnowledge.publicNotes", 100),
    privateNotes: asStringArray(item.privateNotes, "interviewKnowledge.privateNotes", 100),
  };
}

export function parseProfile(value: unknown): Profile {
  const encoded = JSON.stringify(value);
  if (!encoded || encoded.length > PROFILE_DOCUMENT_MAX_CHARS) {
    throw new ProfileValidationError([`Profile JSON 最多 ${PROFILE_DOCUMENT_MAX_CHARS.toLocaleString()} 字元`]);
  }

  const root = asRecord(value, "profile");
  if (root.version !== PROFILE_VERSION) {
    throw new ProfileValidationError([`Profile version 必須是 ${PROFILE_VERSION}`]);
  }
  const personal = asRecord(root.personal, "personal");
  const stats = asRecord(personal.stats, "personal.stats");
  const clients = asRecord(stats.clients, "personal.stats.clients");
  const issues = asRecord(stats.issues, "personal.stats.issues");
  const workExperience = asArray(root.workExperience, "workExperience", 50).map(parseWorkExperience);
  const workIds = workExperience.map((item) => item.id);
  if (new Set(workIds).size !== workIds.length) throw new ProfileValidationError(["工作經歷 ID 不可重複"]);

  const skillGroups = asArray(root.skillGroups, "skillGroups", 30).map((value, index) => {
    const item = asRecord(value, `skillGroups[${index}]`);
    return {
      label: asRequiredString(item.label, `skillGroups[${index}].label`, 200),
      skills: asStringArray(item.skills, `skillGroups[${index}].skills`, 100),
    };
  });

  const projects = asArray(root.projects, "projects", 80).map((value, index) => {
    const path = `projects[${index}]`;
    const item = asRecord(value, path);
    return {
      id: asRequiredString(item.id, `${path}.id`, 100),
      name: asRequiredString(item.name, `${path}.name`, 300),
      description: asString(item.description, `${path}.description`),
      tags: asStringArray(item.tags, `${path}.tags`, 50),
      externalUrl: asString(item.externalUrl, `${path}.externalUrl`, 2_000),
      blogSlug: asString(item.blogSlug, `${path}.blogSlug`, 300),
    };
  });
  const projectIds = projects.map((item) => item.id);
  if (new Set(projectIds).size !== projectIds.length) throw new ProfileValidationError(["作品 ID 不可重複"]);

  const profile: Profile = {
    version: PROFILE_VERSION,
    personal: {
      name: asRequiredString(personal.name, "personal.name", 200),
      title: asRequiredString(personal.title, "personal.title", 500),
      location: asString(personal.location, "personal.location", 300),
      email: asRequiredString(personal.email, "personal.email", 320),
      github: asRequiredString(personal.github, "personal.github", 2_000),
      intro: asString(personal.intro, "personal.intro"),
      stats: {
        clients: {
          value: asNumber(clients.value, "personal.stats.clients.value"),
          label: asRequiredString(clients.label, "personal.stats.clients.label", 200),
          unit: asString(clients.unit, "personal.stats.clients.unit", 100),
        },
        issues: {
          value: asNumber(issues.value, "personal.stats.issues.value"),
          label: asRequiredString(issues.label, "personal.stats.issues.label", 200),
          unit: asString(issues.unit, "personal.stats.issues.unit", 100),
        },
      },
    },
    jobDirections: asStringArray(root.jobDirections, "jobDirections", 30),
    workExperience,
    skillGroups,
    projects,
    interviewKnowledge: parseInterviewKnowledge(root.interviewKnowledge),
    factRules: asStringArray(root.factRules, "factRules", 50),
  };
  return profile;
}

export function cloneProfile(profile: Profile): Profile {
  return parseProfile(JSON.parse(JSON.stringify(profile)) as unknown);
}

/** Removes every private interview field before data reaches a public loader or AI request. */
export function toPublicProfile(profile: Profile): Profile {
  const copy = cloneProfile(profile);
  copy.interviewKnowledge.stories = copy.interviewKnowledge.stories.filter((story) => story.visibility === "public");
  copy.interviewKnowledge.privateNotes = [];
  return copy;
}
