import {
  ncalayerBridgeHealthSchema,
  ncalayerBridgeSignRequestSchema,
  ncalayerBridgeSignatureSchema,
  type NcalayerBridgeHealth,
  type NcalayerBridgeSignRequest,
  type NcalayerBridgeSignature,
} from "@dsj/types";

type BridgeConfig = {
  bridgeUrl: string;
  timeoutMs: number;
};

const proxyBasePath = "/api/ncalayer-bridge";

function buildBridgeUrl(baseUrl: string, path: string) {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\//, ""), normalizedBaseUrl).toString();
}

function buildProxyUrl(path: string) {
  return `${proxyBasePath}/${path.replace(/^\//, "")}`;
}

function isNetworkFetchError(error: unknown) {
  return error instanceof TypeError;
}

function normalizeErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string") {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const data = payload as {
      message?: string | string[];
      error?: string;
    };

    if (Array.isArray(data.message)) {
      return data.message.join(", ");
    }

    if (typeof data.message === "string") {
      return data.message;
    }

    if (typeof data.error === "string") {
      return data.error;
    }
  }

  return fallback;
}

async function requestJson<T>(url: string, init: RequestInit, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Запрос завершился со статусом ${response.status}`;
    const responseText = await response.text();

    if (responseText) {
      try {
        const payload = JSON.parse(responseText) as unknown;
        message = normalizeErrorMessage(payload, message);
      } catch {
        message = responseText;
      }
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

async function fetchJson<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await requestJson<T>(url, init, controller.signal);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Таймаут запроса к мосту NCALayer.");
    }

    if (isNetworkFetchError(error)) {
      return requestJson<T>(buildProxyUrl(new URL(url).pathname), init, controller.signal);
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export async function checkNcalayerBridge(config: BridgeConfig): Promise<NcalayerBridgeHealth> {
  const payload = await fetchJson<unknown>(buildBridgeUrl(config.bridgeUrl, "health"), {}, config.timeoutMs);
  return ncalayerBridgeHealthSchema.parse(payload);
}

export async function signWithNcalayerBridge(
  config: BridgeConfig,
  request: NcalayerBridgeSignRequest,
): Promise<NcalayerBridgeSignature> {
  const payload = ncalayerBridgeSignRequestSchema.parse(request);
  const response = await fetchJson<unknown>(
    buildBridgeUrl(config.bridgeUrl, "sign"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    config.timeoutMs,
  );
  return ncalayerBridgeSignatureSchema.parse(response);
}
