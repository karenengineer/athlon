import { Prisma } from "../generated/prisma/client";

const categories = {
  protein: ["protein", "протеин", "սպիտակուց", "պրոտեին"],
  creatine: ["creatine", "креатин", "կրեատին"],
  "pre-workout": [
    "pre-workout",
    "pre workout",
    "preworkout",
    "предтреник",
    "предтренировочный комплекс",
    "նախավարժանքային",
  ],
  vitamins: [
    "vitamin",
    "vitamins",
    "витамин",
    "витамины",
    "վիտամին",
    "վիտամիններ",
  ],
  "resistance-bands": [
    "resistance bands",
    "resistance band",
    "фитнес резинка",
    "резинки для тренировки",
    "մարզման ժապավեններ",
  ],
} as const;

const aliasToCategory = new Map<string, string>();
for (const [slug, aliases] of Object.entries(categories)) {
  aliasToCategory.set(slug, slug);
  for (const alias of aliases) aliasToCategory.set(alias, slug);
}

export const searchVocabularyLimit = 400;
const candidateLimit = 3;
const correctableWord = /^\p{L}{4,24}$/u;
const maxQueryLength = 120;

export function normalizeProductSearch(value: unknown): string {
  if (typeof value !== "string" || value.length > maxQueryLength) return "";
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  return normalized.length <= maxQueryLength
    ? normalized
    : value.trim().replace(/\s+/gu, " ");
}

export function productSearchWhere(
  scope: Prisma.ProductWhereInput,
  query: string,
): Prisma.ProductWhereInput {
  if (!query) return scope;
  const category = aliasToCategory.get(query.toLowerCase());
  const name = {
    // Prisma's case-insensitive substring matches use ILIKE.
    contains: query.replace(/[\\%_]/g, "\\$&"),
    mode: "insensitive",
  } as const;
  const titleMatch = { translations: { some: { name } } };
  if (!category) return { ...scope, ...titleMatch };
  return {
    ...scope,
    AND: [
      {
        OR: [
          titleMatch,
          {
            category: {
              published: true,
              OR: [
                { slug: category },
                { parent: { slug: category, published: true } },
              ],
            },
          },
        ],
      },
    ],
  };
}

export function canCorrectProductSearch(query: string): boolean {
  const tokens = query.split(" ");
  return (
    tokens.length <= 8 && tokens.some((token) => correctableWord.test(token))
  );
}

export function aliasCorrections(query: string): string[] {
  return corrections(query, [...aliasToCategory.keys()]);
}

export function titleCorrections(
  query: string,
  titles: Array<{ name: string }>,
): string[] {
  const frequency = new Map<string, number>();
  for (const { name } of titles) {
    const words = new Set(
      name
        .normalize("NFKC")
        .toLowerCase()
        .match(/\p{L}+/gu),
    );
    for (const word of words) {
      if (correctableWord.test(word)) {
        frequency.set(word, (frequency.get(word) ?? 0) + 1);
      }
    }
  }
  const words = [...frequency.keys()].sort(
    (left, right) =>
      frequency.get(right)! - frequency.get(left)! || left.localeCompare(right),
  );
  return corrections(query, words);
}

function corrections(query: string, words: string[]): string[] {
  const tokens = query.toLowerCase().split(" ");
  const options = new Set<string>();
  for (const word of words) {
    if (!correctableWord.test(word)) continue;
    const letters = [...word];
    for (const [index, token] of tokens.entries()) {
      if (!correctableWord.test(token) || !oneEditApart([...token], letters))
        continue;
      const corrected = [...tokens];
      corrected[index] = word;
      options.add(corrected.join(" "));
      if (options.size >= candidateLimit) return [...options];
    }
  }
  return [...options];
}

function oneEditApart(first: string[], second: string[]): boolean {
  if (Math.abs(first.length - second.length) > 1) return false;
  const [shorter, longer] =
    first.length <= second.length ? [first, second] : [second, first];
  const difference = shorter.findIndex(
    (letter, index) => letter !== longer[index],
  );
  if (difference === -1) return shorter.length !== longer.length;
  if (shorter.length !== longer.length) {
    return shorter
      .slice(difference)
      .every((letter, index) => letter === longer[difference + index + 1]);
  }
  if (
    shorter
      .slice(difference + 1)
      .every((letter, index) => letter === longer[difference + index + 1])
  ) {
    return true;
  }
  return (
    shorter[difference] === longer[difference + 1] &&
    shorter[difference + 1] === longer[difference] &&
    shorter
      .slice(difference + 2)
      .every((letter, index) => letter === longer[difference + index + 2])
  );
}
