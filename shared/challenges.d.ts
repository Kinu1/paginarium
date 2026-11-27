export type {
  CompetitionRound,
  CompetitionMatch,
  Competition,
} from "./competition";
export type ChallengeFormat =
  | "list"
  | "bingo"
  | "alphabet"
  | "rainbow"
  | "competition";
export interface ChallengeRules {
  name: string;
  description: string;
  instructions: string;
  format: ChallengeFormat;
  items: { key: string; label: string }[];
}
export type Rules = ChallengeRules;
export interface PersonalChallenge {
  id: string;
  rules: ChallengeRules;
  progress: Record<string, string>;
  revision: number;
  published: boolean;
  createdAt: string;
}
export interface PublicTemplate {
  id: string;
  rules: ChallengeRules;
}
export interface TemplatePage {
  items: PublicTemplate[];
  total: number;
  page: number;
  pageSize: number;
}
