export type CompetitionRound =
  | "preliminary"
  | "last16"
  | "quarter"
  | "semi"
  | "final";
export interface CompetitionMatch {
  id: string;
  round: CompetitionRound;
  left: string | null;
  right: string | null;
  winner: string | null;
}
export interface Competition {
  id: string;
  name: string;
  challengeId: string | null;
  revision: number;
  createdAt: string;
  slots: (string | null)[];
  votes: Record<string, string>;
  matches: CompetitionMatch[];
}
