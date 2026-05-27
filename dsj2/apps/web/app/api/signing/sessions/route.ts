import { proxySigningRequest } from "../proxy";

export async function POST(request: Request) {
  return proxySigningRequest("signing/sessions", request);
}
