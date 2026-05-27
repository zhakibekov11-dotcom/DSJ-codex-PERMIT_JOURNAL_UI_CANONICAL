import { Injectable, NotFoundException } from "@nestjs/common";
import { etksEntries, type EtksEntry } from "./etks-v2300033389";

const kzProfessionOverrides = new Map<string, string>([
  [normalizeLookupValue("Наполнитель баллонов"), "Баллондарды толтырушы"],
  [normalizeLookupValue("Переплетчик документов"), "Құжаттарды түптеуші"],
  [
    normalizeLookupValue(
      "Электромонтер по ремонту и обслуживанию электрооборудования",
    ),
    "Электр жабдықты жөндеу және қызмет көрсету жөніндегі электромонтер",
  ],
  [
    normalizeLookupValue(
      "Лаборант электромеханических испытаний и измерений",
    ),
    "Электромеханикалық сынау және өлшеу зертханашысы",
  ],
]);

type IndexedEntry = {
  entry: EtksEntry;
  normalizedRuTitle: string;
  normalizedRuProfession: string;
  normalizedKzProfession: string;
};

const indexedEntries = etksEntries.map<IndexedEntry>((entry) => ({
  entry,
  normalizedRuTitle: normalizeLookupValue(entry.ruTitle),
  normalizedRuProfession: normalizeLookupValue(entry.ruProfession),
  normalizedKzProfession: normalizeLookupValue(entry.kzProfession),
}));

const exactTitleMap = new Map<string, IndexedEntry>();
const exactProfessionMap = new Map<string, IndexedEntry[]>();
const canonicalProfessionMap = new Map<string, string>();

for (const indexedEntry of indexedEntries) {
  if (!exactTitleMap.has(indexedEntry.normalizedRuTitle)) {
    exactTitleMap.set(indexedEntry.normalizedRuTitle, indexedEntry);
  }

  const currentEntries =
    exactProfessionMap.get(indexedEntry.normalizedRuProfession) ?? [];
  currentEntries.push(indexedEntry);
  exactProfessionMap.set(indexedEntry.normalizedRuProfession, currentEntries);
}

for (const [normalizedProfession, entries] of exactProfessionMap.entries()) {
  canonicalProfessionMap.set(
    normalizedProfession,
    chooseCanonicalKzProfession(normalizedProfession, entries),
  );
}

function normalizeLookupValue(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\u00a0/gu, " ")
    .replace(/[ёЁ]/gu, "е")
    .replace(/[«»"“”„‟']/gu, "")
    .replace(/[‐‑–—−]/gu, "-")
    .replace(/\s*-\s*/gu, "-")
    .replace(/\s*,\s*/gu, ", ")
    .replace(/\s+/gu, " ")
    .replace(/[.,;:]+$/gu, "")
    .trim()
    .toLowerCase();
}

function extractGrade(value: string) {
  return (
    value.match(/(?:,\s*|\s+)(\d+)\s*(?:-\s*)?разряд$/u)?.[1]?.trim() ?? null
  );
}

function stripGradeSuffix(value: string) {
  return value
    .replace(/(?:,\s*|\s+)(\d+)\s*(?:-\s*)?разряд$/u, "")
    .trim();
}

function chooseCanonicalKzProfession(
  normalizedProfession: string,
  entries: IndexedEntry[],
): string {
  const override = kzProfessionOverrides.get(normalizedProfession);

  if (override) {
    return override;
  }

  const counts = new Map<string, { value: string; count: number; first: number }>();

  for (const entry of entries) {
    const existing = counts.get(entry.normalizedKzProfession);

    if (existing) {
      existing.count += 1;
      existing.first = Math.min(existing.first, entry.entry.paragraph);
      continue;
    }

    counts.set(entry.normalizedKzProfession, {
      value: entry.entry.kzProfession,
      count: 1,
      first: entry.entry.paragraph,
    });
  }

  return (
    [...counts.values()]
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.first - right.first;
    })[0]?.value ?? entries[0].entry.kzProfession
  );
}

function findRelatedEntries(normalizedInput: string) {
  if (normalizedInput.length < 6) {
    return [];
  }

  return [...exactProfessionMap.entries()]
    .filter(([normalizedProfession]) => {
      return (
        normalizedProfession.includes(normalizedInput) ||
        normalizedInput.includes(normalizedProfession)
      );
    })
    .flatMap(([, entries]) => entries);
}

@Injectable()
export class TranslationsService {
  async translateJobTitle(text: string) {
    const trimmedText = text.trim();
    const normalizedText = normalizeLookupValue(trimmedText);

    const exactTitleMatch = exactTitleMap.get(normalizedText);

    if (exactTitleMatch) {
      return {
        translatedText: exactTitleMatch.entry.kzTitle,
      };
    }

    const grade = extractGrade(trimmedText);
    const normalizedProfession = normalizeLookupValue(
      stripGradeSuffix(trimmedText),
    );
    const professionEntries = exactProfessionMap.get(normalizedProfession) ?? [];

    if (grade) {
      const gradeMatch = professionEntries.find(
        (entry) => entry.entry.grade === grade,
      );

      if (gradeMatch) {
        return {
          translatedText: gradeMatch.entry.kzTitle,
        };
      }
    }

    const exactProfessionMatch = canonicalProfessionMap.get(normalizedProfession);

    if (exactProfessionMatch) {
      return {
        translatedText: exactProfessionMatch,
      };
    }

    const relatedMatches = findRelatedEntries(normalizedProfession);

    if (relatedMatches.length) {
      const relatedProfessionMatches = new Set<string>(
        relatedMatches
          .map((entry) => canonicalProfessionMap.get(entry.normalizedRuProfession))
          .filter((value): value is string => Boolean(value)),
      );

      if (grade) {
        const relatedGradeMatch = relatedMatches.find(
          (entry) => entry.entry.grade === grade,
        );

        if (relatedGradeMatch) {
          return {
            translatedText: relatedGradeMatch.entry.kzTitle,
          };
        }
      }

      if (relatedProfessionMatches.size === 1) {
        const [translatedText] = [...relatedProfessionMatches];

        if (translatedText) {
          return {
            translatedText,
          };
        }
      }
    }

    throw new NotFoundException(
      "Перевод не найден в ЕТКС. Введите вручную.",
    );
  }
}
