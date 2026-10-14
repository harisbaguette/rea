> ## Documentation Index
> Fetch the complete documentation index at: https://docs.platform.decart.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Client Tokens

> Secure realtime authentication for browser and mobile apps

Use client tokens for browser and mobile realtime connections.

Client tokens are short-lived credentials you create on your backend, then pass to your frontend for `client.realtime.connect()` and file uploads.

<Warning>
  Never expose your permanent API key (`dct_...`) in client-side code. Use client tokens for all browser and mobile realtime sessions.
</Warning>

## Why client tokens

* Safe to send to browsers and mobile apps
* Short-lived (configurable TTL, 1–3600 seconds, default 60s; see [Token lifetime](#token-lifetime))
* Optional model scoping (restrict which models the key can access)
* Optional origin scoping (restrict which web origins can use the key — browser-enforced)
* Limited scope (cannot create new tokens)
* Signed, so the gateway verifies them offline and connecting doesn't wait on a key lookup
* Expiration blocks new connections, but does not disconnect active realtime sessions

## End-to-end flow

<Steps>
  <Step title="Create token on your backend">
    Your backend uses your permanent API key to create a client token.
  </Step>

  <Step title="Return token to the frontend">
    Return `apiKey` and `expiresAt` from your backend endpoint.
  </Step>

  <Step title="Connect with the client token">
    Your frontend passes the token to the SDK, minted right before `connect()` or fetched per dial through `apiKeyProvider`. See [Token lifetime](#token-lifetime).
  </Step>
</Steps>

## Options

All options are optional. Without options, tokens use a 60-second TTL and are unrestricted.

| Parameter | Type | Description |
| - | - | - |
| `expiresIn` | `number` | TTL in seconds (1–3600, default 60) |
| `allowedModels` | `string[]` | Restrict which models the key can access (max 20) |
| `allowedOrigins` | `string[]` | Restrict which web origins can use the key (max 20, see [Origin scoping](#origin-scoping)) |
| `constraints` | `object` | Operational limits (see below) |
| `metadata` | `object` | Custom key-value pairs to attach to the token |

**Constraints object:**

```json theme={null}
{
  "realtime": {
    "maxSessionDuration": 120  // max seconds per WebSocket session (min 10)
  }
}
```

<Note>
  **`expiresIn` vs `maxSessionDuration`** — these control different things.
  `expiresIn` sets how long the token can be used to **start** new connections. Once a realtime session is established, the token's expiration does not terminate it.
  `maxSessionDuration` caps how long an individual realtime session can remain active, regardless of token expiration.
  Use both together for full control: e.g. a 5-minute token window with a 2-minute max per session.
</Note>

## Token lifetime

Client tokens expire **60 seconds** after minting by default; `expiresIn` sets the TTL from 1 to 3600 seconds. A token minted on page load is usually dead by the time the user has granted camera access and pressed start, and a reconnect with the same token is refused too.

Keep the token fresh in one of two ways:

<Tabs>
  <Tab title="apiKeyProvider (recommended)">
    Pass a function instead of a key. The SDK calls it right before every `connect()`, connect retry, reconnect and `subscribe()`, so each dial carries a token minted for it:

    ```typescript theme={null}
    const client = createDecartClient({
      apiKeyProvider: async () => {
        const res = await fetch("/api/realtime-token", { method: "POST" }); // your server: client.tokens.create(...)
        const { apiKey } = await res.json();
        return apiKey;
      },
    });
    const realtimeClient = await client.realtime.connect(stream, { model, onRemoteStream });
    ```

    `apiKeyProvider` wins over `apiKey` for realtime; the HTTP APIs (`process`, `queue`, `files`, `tokens`) still use `apiKey` or `proxy`. A provider rejection during `connect()` rejects the call with that error; during a reconnect it is retried like any other dial failure.
  </Tab>

  <Tab title="Mint right before connecting">
    Fetch the token after `getUserMedia` and the user's click, immediately before `connect()`, and size `expiresIn` to your connect window:

    ```typescript theme={null}
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { frameRate: model.fps, width: model.width, height: model.height },
    });

    // Mint now, not on page load.
    const res = await fetch("/api/realtime-token", { method: "POST" });
    const { apiKey } = await res.json();

    const client = createDecartClient({ apiKey });
    const realtimeClient = await client.realtime.connect(stream, { model, onRemoteStream });
    ```

    The SDK cannot refresh a static token, so a reconnect after it expires is refused. Prefer `apiKeyProvider` for sessions that need to survive network drops.
  </Tab>
</Tabs>

### Expired tokens fail fast

Before every realtime dial the SDK reads the token's `exp` claim (5-second clock-skew tolerance) and rejects an expired one with `TOKEN_EXPIRED` without opening a socket:

* `connect()` and `subscribe()` reject with `{ code: "TOKEN_EXPIRED", message, data: { expiresAt, expiredSecondsAgo } }`.
* On a reconnect, the session emits an `error` event with `TOKEN_EXPIRED` and moves to `disconnected` without retrying.

Permanent keys pass through to the server unchanged.

<Note>
  Expiry only gates **new** dials. A realtime session that is already connected keeps running after its token expires. Use `constraints.realtime.maxSessionDuration` to cap how long a session can run.
</Note>

## Model scoping

Pass `allowedModels` to restrict which models a token can be used with. The bouncer verifies model permissions when the client connects — if the model isn't in the allowed list, the connection is rejected.

Tokens created without `allowedModels` are unrestricted and work with any model.

## Origin scoping

Pass `allowedOrigins` to pin a token to a specific list of web origins. When the token is later used to open a realtime session, the connection is accepted only if the browser-issued WebSocket `Origin` header matches one of the listed origins. Mismatched or missing origins are rejected with close code `1008` and `{"type":"error","error":"Origin not allowed"}`.

Each entry must be a **canonical origin** so it compares byte-for-byte to what browsers send. The mint endpoint enforces this and returns a 400 (with the canonical form in the message) when input doesn't match:

* scheme `http://` or `https://`
* lowercase scheme and host
* no trailing slash, path, query, or fragment
* no userinfo (credentials)
* no default port (`:443` for https, `:80` for http)
* max 253 chars per entry, max 20 entries per token

Examples:

| Input | Outcome |
| - | - |
| `https://app.example.com` | accepted |
| `http://localhost:3000` | accepted (non-default port preserved) |
| `https://app.example.com/` | rejected — trailing slash |
| `https://app.example.com:443` | rejected — default port |
| `https://EXAMPLE.com` | rejected — mixed case |
| `https://user@example.com` | rejected — credentials |
| `example.com` | rejected — missing scheme |

Tokens created without `allowedOrigins` are unrestricted (no origin enforcement).

<Note>
  **Defense-in-depth, not hermetic.** Origin enforcement is browser-driven: it materially raises the cost of stolen-token replay from a different web origin, but does not protect against an attacker who controls a non-browser HTTP client and can spoof the `Origin` header. Treat it as one layer alongside short TTLs and model scoping, not a sole boundary.
</Note>

## Backend examples

<CodeGroup>
  ```typescript Next.js Route Handler theme={null}
  // app/api/realtime-token/route.ts
  import { createDecartClient } from "@decartai/sdk";
  import { NextResponse } from "next/server";

  const client = createDecartClient({
    apiKey: process.env.DECART_API_KEY,
  });

  export async function POST() {
    try {
      // Basic — 60s TTL, unrestricted
      const token = await client.tokens.create();
      return NextResponse.json(token);
    } catch {
      return NextResponse.json({ error: "Failed to create token" }, { status: 500 });
    }
  }
  ```

  ```typescript Next.js (scoped) theme={null}
  // app/api/realtime-token/route.ts
  import { createDecartClient } from "@decartai/sdk";
  import { NextResponse } from "next/server";

  const client = createDecartClient({
    apiKey: process.env.DECART_API_KEY,
  });

  export async function POST() {
    try {
      // Scoped — 5 min TTL, restricted model + origin, 2 min max session
      const token = await client.tokens.create({
        expiresIn: 300,
        allowedModels: ["lucy-2.1"],
        allowedOrigins: ["https://app.example.com"],
        constraints: { realtime: { maxSessionDuration: 120 } },
      });
      return NextResponse.json(token);
    } catch {
      return NextResponse.json({ error: "Failed to create token" }, { status: 500 });
    }
  }
  ```

  ```python FastAPI theme={null}
  from fastapi import FastAPI, HTTPException
  from decart import DecartClient
  import os

  app = FastAPI()
  client = DecartClient(api_key=os.environ["DECART_API_KEY"])

  @app.post("/api/realtime-token")
  async def create_realtime_token():
      try:
          # Basic — 60s TTL, unrestricted
          token = await client.tokens.create()
          return {"apiKey": token.api_key, "expiresAt": token.expires_at}
      except Exception:
          raise HTTPException(status_code=500, detail="Failed to create token")
  ```

  ```python FastAPI (scoped) theme={null}
  from fastapi import FastAPI, HTTPException
  from decart import DecartClient
  import os

  app = FastAPI()
  client = DecartClient(api_key=os.environ["DECART_API_KEY"])

  @app.post("/api/realtime-token")
  async def create_realtime_token():
      try:
          # Scoped — 5 min TTL, restricted model + origin, 2 min max session
          token = await client.tokens.create(
              expires_in=300,
              allowed_models=["lucy-2.1"],
              allowed_origins=["https://app.example.com"],
              constraints={"realtime": {"maxSessionDuration": 120}},
          )
          return {
              "apiKey": token.api_key,
              "expiresAt": token.expires_at,
              "permissions": token.permissions,
              "constraints": token.constraints,
          }
      except Exception:
          raise HTTPException(status_code=500, detail="Failed to create token")
  ```
</CodeGroup>

## Frontend example

```typescript theme={null}
import { createDecartClient, models } from "@decartai/sdk";

const model = models.realtime("lucy-2.1");

// The SDK calls the provider right before every connect and reconnect, so each
// dial carries a token minted for it. Client tokens expire 60 s after minting.
const client = createDecartClient({
  apiKeyProvider: async () => {
    const res = await fetch("/api/realtime-token", { method: "POST" });
    const { apiKey } = await res.json(); // the short-lived client token, never your permanent key
    return apiKey;
  },
});

async function connectRealtime() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { frameRate: model.fps, width: model.width, height: model.height },
    audio: true,
  });

  return client.realtime.connect(stream, {
    model,
    onRemoteStream: (remoteStream) => {
      document.getElementById("output").srcObject = remoteStream;
    },
    initialState: {
      prompt: { text: "Anime style", enhance: true },
    },
  });
}
```

## Rotation strategy

* Mint a token right before each connect, or let `apiKeyProvider` do it for every connect and reconnect. Never mint on page load
* Use shorter TTLs (e.g. 60s) for tighter security; use longer TTLs (e.g. 300–600s) when you mint ahead of connecting
* An expired token is refused before dialling (`TOKEN_EXPIRED`). Mint a new one instead of retrying with the old
* Do not persist client tokens in local storage
* A client token cannot be revoked before `expiresAt`; use a short TTL where fast cut-off matters
* Revoke permanent keys in dashboard if you suspect leakage

<Tip>
  For production readiness, also follow the realtime reliability guide in [Streaming Best Practices](/models/realtime/streaming-best-practices).
</Tip>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.