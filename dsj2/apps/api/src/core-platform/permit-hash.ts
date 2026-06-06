import { hashDocumentPayload } from "@dsj/utils";

function normalize(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]),
    );
  }

  return value;
}

export function canonicalPermitPayload(value: unknown) {
  return JSON.stringify(normalize(value));
}

export function canonicalPermitPayloadHash(value: unknown) {
  return hashDocumentPayload(canonicalPermitPayload(value));
}
