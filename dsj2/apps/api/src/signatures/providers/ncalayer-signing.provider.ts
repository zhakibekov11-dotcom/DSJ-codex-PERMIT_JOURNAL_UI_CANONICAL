import { BadRequestException, Injectable } from "@nestjs/common";
import { maskIin } from "@dsj/database";
import { parseCmsCertificate } from "@dsj/utils";
import { normalizeIin } from "../signing.utils";
import type { NcalayerSigningInput, SigningContext, SigningResult } from "../signing.types";

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeSerial(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function normalizeThumbprint(value: string) {
  return value.replace(/[:\s]+/g, "").toUpperCase();
}

@Injectable()
export class NcalayerSigningProvider {
  sign(input: SigningContext & NcalayerSigningInput): SigningResult {
    if (!input.documentHash) {
      throw new BadRequestException("A document hash must exist before NCALayer signing can complete.");
    }

    const expectedDigest = input.documentHash.toLowerCase();
    const actualDigest = input.signingDigest.toLowerCase();

    if (actualDigest !== expectedDigest) {
      throw new BadRequestException("NCALayer signing digest does not match the record.");
    }

    const signedAt = new Date(input.signedAt);

    if (Number.isNaN(signedAt.getTime())) {
      throw new BadRequestException("NCALayer signedAt must be a valid ISO timestamp.");
    }

    let certificate: ReturnType<typeof parseCmsCertificate>;

    try {
      certificate = parseCmsCertificate(input.cms);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "The NCALayer CMS payload is malformed.",
      );
    }

    const signerIin = normalizeIin(certificate.signerIin);

    if (signerIin.length !== 12) {
      throw new BadRequestException("The NCALayer certificate does not contain a valid signer IIN.");
    }

    if (signerIin !== normalizeIin(input.signerIin)) {
      throw new BadRequestException("The bridge payload signer IIN does not match the embedded certificate.");
    }

    if (normalizeText(certificate.signerName) !== normalizeText(input.signerName)) {
      throw new BadRequestException("The bridge payload signer name does not match the embedded certificate.");
    }

    if (normalizeSerial(certificate.certificateSerial) !== normalizeSerial(input.certificateSerial)) {
      throw new BadRequestException("The bridge payload certificate serial does not match the embedded certificate.");
    }

    if (
      normalizeThumbprint(certificate.certificateThumbprint) !==
      normalizeThumbprint(input.certificateThumbprint)
    ) {
      throw new BadRequestException(
        "The bridge payload certificate thumbprint does not match the embedded certificate.",
      );
    }

    if (normalizeText(certificate.certificateSubject) !== normalizeText(input.certificateSubject)) {
      throw new BadRequestException("The bridge payload certificate subject does not match the embedded certificate.");
    }

    if (normalizeText(certificate.certificateIssuer) !== normalizeText(input.certificateIssuer)) {
      throw new BadRequestException("The bridge payload certificate issuer does not match the embedded certificate.");
    }

    if (certificate.certificateValidFrom !== input.certificateValidFrom) {
      throw new BadRequestException(
        "The bridge payload certificate validity start does not match the embedded certificate.",
      );
    }

    if (certificate.certificateValidTo !== input.certificateValidTo) {
      throw new BadRequestException(
        "The bridge payload certificate validity end does not match the embedded certificate.",
      );
    }

    const validFrom = new Date(certificate.certificateValidFrom);
    const validTo = new Date(certificate.certificateValidTo);

    if (signedAt < validFrom || signedAt > validTo) {
      throw new BadRequestException("The certificate was not valid at the provided signing timestamp.");
    }

    const signerIinMasked = maskIin(signerIin);

    return {
      provider: "NCALAYER",
      status: "SIGNED",
      signedAt,
      documentHash: input.documentHash,
      signerName: certificate.signerName,
      signerIin,
      signerIinMasked,
      certificateSerial: certificate.certificateSerial,
      payload: {
        provider: "NCALAYER",
        signingDigest: actualDigest,
        signedAt: signedAt.toISOString(),
        signerName: certificate.signerName,
        signerIinMasked,
        certificateSerial: certificate.certificateSerial,
        certificateThumbprint: certificate.certificateThumbprint,
        certificateSubject: certificate.certificateSubject,
        certificateIssuer: certificate.certificateIssuer,
        certificateValidFrom: certificate.certificateValidFrom,
        certificateValidTo: certificate.certificateValidTo,
        cms: input.cms,
        bridgeVersion: input.bridgeVersion ?? null,
        bridgeUrl: input.bridgeUrl ?? null,
      },
    };
  }
}
