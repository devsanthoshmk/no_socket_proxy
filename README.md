# HTTP streaming proxy: WebSocket-free proxy for Cloudflare Workers

A Cloudflare Worker HTTP streaming proxy that routes dynamic traffic without WebSocket connections.

This project is a streaming proxy that runs on Cloudflare Workers. It is a WebSocket-free proxy for microservices, APIs, and edge applications that streams HTTP request and response bodies directly through Fetch API readable streams. By relying on native runtime streaming and Cloudflare Workers KV lookups, the worker maintains HTTP streaming without socket connections, server processes, or memory buffering.

## Architecture

The proxy handles two request flows in `src/index.js`:

1. Key-value management at the root path (`/`). The worker checks for a `key` query parameter.
   - If `key` and `value` query parameters are present, the worker writes the pair to the `redirect_list` KV namespace with `put(key, value)`.
   - If the request method is `POST` and a `key` query parameter is present, the worker reads the request text body and writes it to `redirect_list`.
   - If only the `key` query parameter is present in a `GET` request, the worker retrieves the mapped target URL from `redirect_list` with `get(key)`.
   - If no `key` parameter is present, the worker returns plain text instructions for route configuration.

2. Request proxying at subpaths (`/<key>/<rest_of_path>`). The worker extracts the first path segment as the routing key with `decodeURIComponent`.
   - The worker looks up the target base URL for that key in the `redirect_list` KV store. If the key does not exist, the worker returns an HTTP 404 response.
   - The worker strips any trailing slash from the target base URL, appends the remaining path segments, and forwards all original search query parameters.
   - The worker constructs a new `Request` object with the target URL, matching method, incoming headers, and the raw `request.body` stream. It sets the `redirect` option to `follow`.
   - The worker calls global `fetch(newRequest)` and passes the resulting stream directly into `new Response(response.body, response)`. This preserves streaming data flow between the client and upstream origin.

## Setup

1. Install project dependencies:

```bash
pnpm install
```

2. Log in to your Cloudflare account with the Wrangler command line tool:

```bash
npx wrangler login
```

3. Create a Cloudflare Workers KV namespace for route storage:

```bash
npx wrangler kv namespace create redirect_list
```

4. Insert the generated namespace ID into the `kv_namespaces` array inside `wrangler.jsonc`.

5. Deploy the worker to Cloudflare:

```bash
pnpm run deploy
```

## Usage

### Store a proxy route

Map a routing key to a target base URL using a `GET` query or a `POST` request body.

With a `GET` query parameter:

```bash
curl "https://<worker_url>/?key=api&value=https://api.example.com"
```

With a `POST` request body:

```bash
curl -X POST "https://<worker_url>/?key=api" -d "https://api.example.com"
```

### Retrieve a stored route

Check the current upstream target URL for a specific key:

```bash
curl "https://<worker_url>/?key=api"
```

### Forward traffic through the streaming proxy

Send requests using the path format `https://<worker_url>/<key>/<rest_of_path>`.

Forward a `GET` request with query parameters:

```bash
curl "https://<worker_url>/api/users?page=2"
```

The worker forwards the request to `https://api.example.com/users?page=2` and streams the response back to the client.

Forward a `POST` request with an HTTP request body:

```bash
curl -X POST "https://<worker_url>/api/events" \
  -H "Content-Type: application/json" \
  -d '{"event":"checkout"}'
```

The worker streams the request payload to `https://api.example.com/events` and returns the upstream response stream.

## Configuration

Configuration values are defined in `wrangler.jsonc`:

- `name`: The worker script name. Default is `proxy`.
- `main`: The entry point file path. Default is `src/index.js`.
- `compatibility_date`: Cloudflare runtime compatibility date. Set to `2025-12-29`.
- `observability`: Runtime log settings. Set to `{"enabled": true}`.
- `kv_namespaces`: An array containing KV bindings. The binding must be named `redirect_list` and set to your KV namespace ID.
