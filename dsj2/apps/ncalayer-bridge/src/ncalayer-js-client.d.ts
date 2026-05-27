declare module "ncalayer-js-client" {
  export class NCALayerClient {
    constructor(url?: string, allowKmdHttpApi?: boolean);
    wsConnection: { close(): void } | null;
    connect(): Promise<string>;
    basicsSignCMS(
      allowedStorages: unknown,
      data: string | string[],
      signingParams: Record<string, unknown>,
      signerParams: Record<string, unknown>,
      locale?: string,
    ): Promise<string | string[]>;
    static basicsStorageAll: unknown;
    static basicsCMSParamsDetachedHash: Record<string, unknown>;
    static basicsSignerTestAny: Record<string, unknown>;
    static basicsSignerSignAny: Record<string, unknown>;
  }
}
