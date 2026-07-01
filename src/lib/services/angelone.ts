const ANGELONE_ROOT = "https://apiconnect.angelone.in";
const LOGIN_ENDPOINT = "/rest/auth/angelbroking/user/v1/loginByPassword";

type AuthenticateAngelOneParams = {
  apiKey: string;
  clientCode: string;
  password: string;
  totp: string;
  clientLocalIp: string;
  clientPublicIp: string;
  macAddress: string;
};

function buildHeaders({
  apiKey,
  clientLocalIp,
  clientPublicIp,
  macAddress,
}: Omit<AuthenticateAngelOneParams, "clientCode" | "password" | "totp">) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": clientLocalIp,
    "X-ClientPublicIP": clientPublicIp,
    "X-MACAddress": macAddress,
    "X-PrivateKey": apiKey,
  };
}

async function parsePayload(response: Response) {
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      String(payload.message ?? payload.errorcode ?? payload.errorCode ?? "AngelOne request failed.");
    throw new Error(message);
  }

  const success = payload.status ?? payload.success;
  if (success !== true) {
    const message =
      String(payload.message ?? payload.errorcode ?? payload.errorCode ?? "AngelOne authentication failed.");
    throw new Error(message);
  }

  return payload as {
    data: {
      jwtToken: string;
      refreshToken?: string;
      feedToken?: string;
    };
  };
}

export async function authenticateAngelOne(params: AuthenticateAngelOneParams) {
  const response = await fetch(`${ANGELONE_ROOT}${LOGIN_ENDPOINT}`, {
    method: "POST",
    headers: buildHeaders(params),
    body: JSON.stringify({
      clientcode: params.clientCode,
      password: params.password,
      totp: params.totp,
    }),
    cache: "no-store",
  });

  const payload = await parsePayload(response);
  return {
    jwtToken: payload.data.jwtToken,
    refreshToken: payload.data.refreshToken ?? "",
    feedToken: payload.data.feedToken ?? "",
    loggedInAt: new Date().toISOString(),
  };
}
