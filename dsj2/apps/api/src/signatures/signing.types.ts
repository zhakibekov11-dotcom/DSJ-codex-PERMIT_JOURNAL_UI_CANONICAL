import type { Prisma } from "@prisma/client";
import type { MockSignInput, NcalayerBridgeSignature, SignatureProvider } from "@dsj/types";

export type SigningContext = {
  entityId: string;
  entityType:
    | "BRIEFING_RECORD"
    | "EMPLOYEE_DOCUMENT"
    | "PROTOCOL"
    | "RESPONSIBILITY_ORDER";
  documentHash: string | null;
};

export type MockSigningInput = MockSignInput;

export type NcalayerSigningInput = NcalayerBridgeSignature;

export type SigningInput = MockSigningInput | NcalayerSigningInput;

export type SigningResult = {
  provider: SignatureProvider;
  status: "SIGNED";
  signedAt: Date;
  documentHash: string;
  signerName: string;
  signerIin: string;
  signerIinMasked: string;
  certificateSerial: string;
  payload: Prisma.InputJsonValue;
};
