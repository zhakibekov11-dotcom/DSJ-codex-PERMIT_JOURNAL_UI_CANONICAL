import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, test } from "node:test";
import { createBridgeServer } from "./bridge-service";

const TEST_DIGEST = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const parsedCertificate = {
  certificateSerial: "CERT-123456",
  certificateThumbprint: "THUMBPRINT123456",
  certificateSubject: "CN=Aigerim Sadykova, SERIALNUMBER=IIN980317350011",
  certificateIssuer: "CN=NCALayer Test CA",
  certificateValidFrom: "2026-03-01T00:00:00.000Z",
  certificateValidTo: "2027-03-01T00:00:00.000Z",
  signerName: "Aigerim Sadykova",
  signerIin: "980317350011",
};

let serversToClose: Array<ReturnType<typeof createBridgeServer>> = [];

afterEach(async () => {
  await Promise.all(
    serversToClose.map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        }),
    ),
  );
  serversToClose = [];
});

test("bridge health and sign endpoints expose the NCALayer contract", async () => {
  const server = createBridgeServer({
    allowedOrigins: ["https://app.example.com"],
    runtime: {
      async connect() {
        return "2.0.0";
      },
      async signDigest() {
        return {
          cms: "cms-payload",
          version: "2.0.0",
        };
      },
    },
    parseCertificate() {
      return parsedCertificate;
    },
    logger: {
      info() {},
      error() {},
    },
  });

  serversToClose.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const healthResponse = await fetch(`${baseUrl}/health`, {
    headers: {
      Origin: "https://app.example.com",
    },
  });
  const healthPayload = await healthResponse.json();

  assert.equal(healthResponse.status, 200);
  assert.deepEqual(healthPayload, {
    ok: true,
    provider: "NCALAYER",
    version: "2.0.0",
    bridgeUrl: baseUrl,
  });

  const signResponse = await fetch(`${baseUrl}/sign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://app.example.com",
    },
    body: JSON.stringify({
      digest: TEST_DIGEST,
      testMode: true,
      context: {
        briefingRecordId: "record-1",
      },
    }),
  });
  const signPayload = await signResponse.json();

  assert.equal(signResponse.status, 200);
  assert.equal(signPayload.signingDigest, TEST_DIGEST);
  assert.equal(signPayload.cms, "cms-payload");
  assert.equal(signPayload.bridgeVersion, "2.0.0");
  assert.equal(signPayload.bridgeUrl, baseUrl);
  assert.equal(signPayload.certificateSerial, parsedCertificate.certificateSerial);
  assert.equal(signPayload.signerIin, parsedCertificate.signerIin);
  assert.equal(typeof signPayload.signedAt, "string");
});

test("bridge rejects disallowed origins before invoking the runtime", async () => {
  let connectCalls = 0;

  const server = createBridgeServer({
    allowedOrigins: ["https://app.example.com"],
    runtime: {
      async connect() {
        connectCalls += 1;
        return "2.0.0";
      },
      async signDigest() {
        throw new Error("should not be called");
      },
    },
    logger: {
      info() {},
      error() {},
    },
  });

  serversToClose.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  const response = await fetch(`${baseUrl}/health`, {
    headers: {
      Origin: "https://evil.example.com",
    },
  });
  const payload = await response.json();

  assert.equal(response.status, 403);
  assert.equal(payload.message, "Origin is not allowed to use the NCALayer bridge.");
  assert.equal(connectCalls, 0);
});
