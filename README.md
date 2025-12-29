# Cloudflare Worker Proxy & KV Manager

This Cloudflare Worker acts as a dynamic proxy and a Key-Value (KV) store manager. It allows you to map keys to target URLs and then proxy requests to those targets.

## Features

1.  **Dynamic Proxying**: Reroute traffic based on a key in the URL path.
2.  **KV Management**: Set and Get key-value pairs (Target URLs) directly via HTTP requests.

## Setup

1.  Ensure you have `wrangler` installed.
2.  Ensure you have a KV Namespace bound to your worker with the binding name `redirect_list`.
    - In `wrangler.jsonc`:
      ```json
      "kv_namespaces": [
        {
          "binding": "redirect_list",
          "id": "<YOUR_KV_NAMESPACE_ID>"
        }
      ]
      ```

## Usage

### 1. Managing Keys (KV Operations)

You can manage the redirection keys using the root URL of the worker.

#### Set a Key (Target URL)

You can set a key using either a GET request with query parameters or a POST request.

**Method A: GET Request**

```
GET https://<worker_url>/?key=<your_key>&value=<target_url>
```

- `key`: The identifier you want to use in the proxy path.
- `value`: The base URL where traffic should be forwarded.

**Example:**

```
GET https://my-worker.workers.dev/?key=google&value=https://www.google.com
```

**Method B: POST Request**

```
POST https://<worker_url>/?key=<your_key>
Body: <target_url>
```

**Example:**

```bash
curl -X POST "https://my-worker.workers.dev/?key=api" -d "https://api.example.com/v1"
```

#### Get a Key's Value

To see what URL a key is mapped to:

```
GET https://<worker_url>/?key=<your_key>
```

**Example:**

```
GET https://my-worker.workers.dev/?key=google
Response: https://www.google.com
```

### 2. Proxying Requests

Once a key is set, you can use it to proxy requests.

**URL Structure:**

```
https://<worker_url>/<key>/<rest_of_path>?<query_params>
```

- `<key>`: The key you set previously.
- `<rest_of_path>`: The path you want to append to the target URL.
- `<query_params>`: Any query parameters to forward.

**How it works:**

1.  The worker extracts `<key>` from the URL.
2.  It looks up the target URL associated with `<key>` in the KV store.
3.  It constructs a new URL by combining the target URL with `<rest_of_path>` and `<query_params>`.
4.  It forwards the request (including Method, Headers, and Body) to the new URL.
5.  It returns the response from the target URL.

**Example:**

Assume you have set `key=google` to `https://www.google.com`.

Request:

```
GET https://my-worker.workers.dev/google/search?q=hello
```

The worker will forward this request to:

```
https://www.google.com/search?q=hello
```

**Example 2:**

Assume you have set `key=api` to `https://api.example.com/v1`.

Request:

```
POST https://my-worker.workers.dev/api/users
Body: { "name": "John" }
```

The worker will forward this request to:

```
POST https://api.example.com/v1/users
Body: { "name": "John" }
```

## Deployment

To deploy the worker:

```bash
npm run deploy
```
