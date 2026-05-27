import { Injectable } from "@nestjs/common";
import { maskIin } from "@dsj/database";
import { hashDocumentPayload } from "@dsj/utils";
import { normalizeIin } from "../signing.utils";
import type { MockSigningInput, SigningContext, SigningResult } from "../signing.types";

@Injectable()
export class MockSigningProvider {
  sign(input: SigningContext & MockSigningInput): SigningResult {
    const signedAt = new Date();
    const signerIin = normalizeIin(input.signerIin);
    const documentHash =
      input.documentHash ??
      hashDocumentPayload(
        JSON.stringify({
          entityId: input.entityId,
          entityType: input.entityType,
          signerName: input.signerName,
          signedAt: signedAt.toISOString(),
        }),
      );

    return {
      provider: "MOCK_NCALAYER" as const,
      status: "SIGNED" as const,
      signedAt,
      documentHash,
      signerName: input.signerName,
      signerIin,
      signerIinMasked: maskIin(signerIin),
      certificateSerial: input.certificateSerial,
      payload: {
        provider: "MOCK_NCALAYER",
        signerName: input.signerName,
        signerIinMasked: maskIin(signerIin),
        certificateSerial: input.certificateSerial,
        signedAt: signedAt.toISOString(),
        documentHash,
      },
    };
  }
}

