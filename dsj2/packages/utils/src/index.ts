import { clsx, type ClassValue } from "clsx";
import { createHash } from "node:crypto";
import { X509Certificate } from "node:crypto";
import * as asn1js from "asn1js";
import { Certificate, ContentInfo, SignedData } from "pkijs";
import { twMerge } from "tailwind-merge";

export * from "./compliance";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: Date | string, locale = "ru-KZ") {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: Date | string, locale = "ru-KZ") {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatStatusLabel(value: string) {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function hashDocumentPayload(payload: string) {
  return createHash("sha256").update(payload).digest("hex");
}

type DistinguishedNameMap = Record<string, string>;

export type ParsedCmsCertificate = {
  certificateSerial: string;
  certificateThumbprint: string;
  certificateSubject: string;
  certificateIssuer: string;
  certificateValidFrom: string;
  certificateValidTo: string;
  signerName: string;
  signerIin: string;
};

function normalizePemBlock(value: string) {
  return value
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
}

function toArrayBuffer(value: Buffer): ArrayBuffer {
  return Uint8Array.from(value).buffer;
}

function parseDistinguishedName(value: string): DistinguishedNameMap {
  return value
    .split(/\r?\n|,(?=[A-Z][A-Z0-9.]+=)|\/(?=[A-Z][A-Z0-9.]+=)/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.includes("="))
    .reduce<DistinguishedNameMap>((accumulator, segment) => {
      const [rawKey, ...rawValue] = segment.split("=");
      const key = rawKey.trim().toUpperCase();
      const mappedValue = rawValue.join("=").trim();

      if (key && mappedValue && !(key in accumulator)) {
        accumulator[key] = mappedValue;
      }

      return accumulator;
    }, {});
}

function extractIin(subject: string, subjectFields: DistinguishedNameMap) {
  const serialNumber = subjectFields.SERIALNUMBER ?? subjectFields.SERIAL ?? "";
  const serialMatch = serialNumber.match(/(?:IIN|BIN)?\s*(\d{12})/i);

  if (serialMatch) {
    return serialMatch[1];
  }

  const subjectMatch = subject.match(/\b\d{12}\b/);

  if (subjectMatch) {
    return subjectMatch[0];
  }

  throw new Error("The signer IIN was not found in the certificate subject.");
}

function extractSignerName(subjectFields: DistinguishedNameMap) {
  const commonName = subjectFields.CN ?? subjectFields.COMMONNAME;

  if (commonName) {
    return commonName;
  }

  const givenName = subjectFields.GIVENNAME ?? subjectFields.G;
  const surname = subjectFields.SURNAME ?? subjectFields.SN;

  if (givenName && surname) {
    return `${givenName} ${surname}`.trim();
  }

  throw new Error("The signer name was not found in the certificate subject.");
}

export function parseCmsCertificate(cms: string): ParsedCmsCertificate {
  const normalizedCms = normalizePemBlock(cms);
  const cmsBuffer = Buffer.from(normalizedCms, "base64");
  const cmsAsn1 = asn1js.fromBER(toArrayBuffer(cmsBuffer));

  if (cmsAsn1.offset === -1) {
    throw new Error("Failed to parse CMS payload.");
  }

  const contentInfo = new ContentInfo({ schema: cmsAsn1.result });
  const signedData = new SignedData({ schema: contentInfo.content });
  const certificateSchema = signedData.certificates?.find(
    (certificate): certificate is Certificate => certificate instanceof Certificate,
  );

  if (!certificateSchema) {
    throw new Error("The CMS payload does not contain an embedded signing certificate.");
  }

  const certificateBuffer = Buffer.from(certificateSchema.toSchema().toBER(false));
  const certificate = new X509Certificate(certificateBuffer);
  const subjectFields = parseDistinguishedName(certificate.subject);

  return {
    certificateSerial: certificate.serialNumber,
    certificateThumbprint: certificate.fingerprint.replace(/:/g, ""),
    certificateSubject: certificate.subject,
    certificateIssuer: certificate.issuer,
    certificateValidFrom: new Date(certificate.validFrom).toISOString(),
    certificateValidTo: new Date(certificate.validTo).toISOString(),
    signerName: extractSignerName(subjectFields),
    signerIin: extractIin(certificate.subject, subjectFields),
  };
}

