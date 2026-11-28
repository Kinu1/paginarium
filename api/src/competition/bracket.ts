import { BadRequestException, ConflictException } from "@nestjs/common";
import { randomInt } from "node:crypto";

type Round = "preliminary" | "last16" | "quarter" | "semi" | "final";
type Source = number | string;
type Pair = { id: string; round: Round; left: Source; right: Source };

function makePairs(
  count: number,
  round: Round,
  prefix: string,
  participants: Source[],
): Pair[] {
  return Array.from({ length: count }, (_, i) => ({
    id: prefix + (i + 1),
    round,
    left: participants[i * 2],
    right: participants[i * 2 + 1],
  }));
}
const preliminaries = makePairs(
  6,
  "preliminary",
  "P",
  Array.from({ length: 12 }, (_, i) => i),
);
const qualifiers: Source[] = preliminaries.flatMap((p, i) => [12 + i, p.id]);
qualifiers.push(18, 19, 20, 21);
const last16 = makePairs(8, "last16", "O", qualifiers);
const quarters = makePairs(
  4,
  "quarter",
  "Q",
  last16.map((p) => p.id),
);
const semis = makePairs(
  2,
  "semi",
  "S",
  quarters.map((p) => p.id),
);
const final = makePairs(
  1,
  "final",
  "F",
  semis.map((p) => p.id),
);
export const pairs = [
  ...preliminaries,
  ...last16,
  ...quarters,
  ...semis,
  ...final,
];
type Votes = Record<string, string>;

export function draw(ids: string[]) {
  if (ids.length !== 22 || new Set(ids).size !== 22)
    throw new BadRequestException("Escolha 22 livros diferentes.");
  const slots = [...ids];
  for (let i = slots.length - 1; i > 0; i--) {
    const next = randomInt(i + 1);
    [slots[i], slots[next]] = [slots[next], slots[i]];
  }
  return slots;
}

export function matches(slots: (string | null)[], votes: Votes) {
  const winners = new Map<string, string | null>();
  const participant = (source: Source) =>
    typeof source === "number" ? slots[source] : (winners.get(source) ?? null);
  return pairs.map((pair) => {
    const left = participant(pair.left);
    const right = participant(pair.right);
    const voted = votes[pair.id];
    const winner =
      left && right && (voted === left || voted === right) ? voted : null;
    winners.set(pair.id, winner);
    return { id: pair.id, round: pair.round, left, right, winner };
  });
}

export function invalidate(source: Source, votes: Votes) {
  const next = { ...votes };
  let child = pairs.find(
    (pair) => pair.left === source || pair.right === source,
  );
  while (child) {
    delete next[child.id];
    const previous = child.id;
    child = pairs.find(
      (pair) => pair.left === previous || pair.right === previous,
    );
  }
  return next;
}

export function vote(
  slots: (string | null)[],
  votes: Votes,
  matchId: string,
  winnerId: string,
) {
  if (slots.includes(null))
    throw new ConflictException("Reponha as vagas antes de votar.");
  const match = matches(slots, votes).find((m) => m.id === matchId);
  if (
    !match ||
    !match.left ||
    !match.right ||
    ![match.left, match.right].includes(winnerId)
  )
    throw new BadRequestException(
      "Escolha um dos dois participantes deste confronto.",
    );
  if (match.winner === winnerId) return votes;
  return { ...invalidate(match.id, votes), [match.id]: winnerId };
}
