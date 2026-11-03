export const SKILL_KEYS = ['Q', 'W', 'E', 'R'] as const;
export type SkillKey = (typeof SKILL_KEYS)[number];
