import { NCALayerClient } from "ncalayer-js-client";

export type BridgeRuntime = {
  connect(): Promise<string | null>;
  signDigest(args: { digest: string; testMode: boolean }): Promise<{
    cms: string;
    version: string | null;
  }>;
};

export type NcalayerRuntimeConfig = {
  wsUrl: string;
  allowKmdHttpApi: boolean;
};

function digestHexToBase64(digest: string) {
  return Buffer.from(digest, "hex").toString("base64");
}

export class NcalayerRuntime implements BridgeRuntime {
  constructor(private readonly config: NcalayerRuntimeConfig) {}

  async connect() {
    return this.withClient((client) => client.connect());
  }

  async signDigest(args: { digest: string; testMode: boolean }) {
    return this.withClient(async (client) => {
      const version = await client.connect();
      const signerParams = args.testMode
        ? NCALayerClient.basicsSignerTestAny
        : NCALayerClient.basicsSignerSignAny;
      const cms = await client.basicsSignCMS(
        NCALayerClient.basicsStorageAll,
        digestHexToBase64(args.digest),
        NCALayerClient.basicsCMSParamsDetachedHash,
        signerParams,
        "ru",
      );

      if (typeof cms !== "string") {
        throw new Error("NCALayer returned an unexpected multi-signature payload.");
      }

      return {
        cms,
        version,
      };
    });
  }

  private async withClient<T>(callback: (client: NCALayerClient) => Promise<T>) {
    const client = new NCALayerClient(this.config.wsUrl, this.config.allowKmdHttpApi);

    try {
      return await callback(client);
    } finally {
      client.wsConnection?.close();
    }
  }
}
