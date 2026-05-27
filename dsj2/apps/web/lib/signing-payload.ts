import {
  mockSignSchema,
  ncalayerBridgeSignatureSchema,
  type BriefingSignInput,
  type NcalayerBridgeSignature,
} from "@dsj/types";

export function readBridgePayload(formData: FormData): NcalayerBridgeSignature | null {
  const rawValue = formData.get("bridgePayloadJson");

  if (typeof rawValue !== "string" || !rawValue.trim().length) {
    return null;
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    throw new Error("Некорректный bridge payload.");
  }

  return ncalayerBridgeSignatureSchema.parse(parsedValue);
}

export function readSigningInput(formData: FormData): BriefingSignInput | undefined {
  const bridgePayload = readBridgePayload(formData);

  if (bridgePayload) {
    return bridgePayload;
  }

  const signerName = String(formData.get("signerName") ?? "").trim();
  const signerIin = String(formData.get("signerIin") ?? "").trim();
  const certificateSerial = String(formData.get("certificateSerial") ?? "").trim();

  if (!signerName && !signerIin && !certificateSerial) {
    return undefined;
  }

  return mockSignSchema.parse({
    signerName,
    signerIin,
    certificateSerial,
  });
}
