export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const path = url.pathname;

		// Operation 2: KV Management (Root path)
		// https://<worker_url>?key=<value> (GET/POST)
		if (path === '/' || path === '') {
			const key = url.searchParams.get('key');
			const value = url.searchParams.get('value');

			if (!key) {
				return new Response(
					'Usage:\n' +
					'1. Proxy: https://<worker_url>/<key>/<rest_of_path>\n' +
					'2. Get KV: GET https://<worker_url>/?key=<key>\n' +
					'3. Set KV: GET https://<worker_url>/?key=<key>&value=<target_url>\n' +
					'4. Set KV: POST https://<worker_url>/?key=<key> (body contains target_url)',
					{ status: 200 }
				);
			}

			// Set KV via GET query param
			if (value) {
				await env.redirect_list.put(key, value);
				return new Response(`Successfully set key "${key}" to "${value}"`, { status: 200 });
			}

			// Set KV via POST body
			if (request.method === 'POST') {
				const bodyValue = await request.text();
				if (bodyValue) {
					await env.redirect_list.put(key, bodyValue);
					return new Response(`Successfully set key "${key}" to "${bodyValue}"`, { status: 200 });
				} else {
					return new Response('Missing body for POST request', { status: 400 });
				}
			}

			// Get KV value
			const existingValue = await env.redirect_list.get(key);
			if (existingValue) {
				return new Response(existingValue, { status: 200 });
			} else {
				return new Response(`Key "${key}" not found`, { status: 404 });
			}
		}

		// Operation 1: Proxy/Redirect
		// https://<worker_url>/<key>/regest(optinal)?query_preams=<value>(optinal)

		const pathParts = path.split('/');
		// pathParts[0] is empty because path starts with /
		const key = pathParts[1];

		if (!key) {
			return new Response('Invalid path structure', { status: 400 });
		}

		const targetBaseUrl = await env.redirect_list.get(key);

		if (!targetBaseUrl) {
			return new Response(`Proxy target for key "${key}" not found`, { status: 404 });
		}

		try {
			// Construct the new URL
			// Remove the /<key> part from the path to get the "rest"
			// Example: /google/search -> /search
			// Example: /google -> /

			// We need to be careful to only remove the first occurrence of /key
			// path is like /key/rest

			let suffix = path.substring(1 + key.length); // Skip first slash and key
			if (!suffix.startsWith('/') && suffix.length > 0) {
				suffix = '/' + suffix;
			}
            if (suffix === '') {
                suffix = '/';
            }

			// Prepare base URL (remove trailing slash if present to avoid double slashes)
			let cleanBaseUrl = targetBaseUrl;
			if (cleanBaseUrl.endsWith('/')) {
				cleanBaseUrl = cleanBaseUrl.slice(0, -1);
			}

			// If suffix is just '/', and we want to respect the targetBaseUrl exactly if it has a path
			// e.g. target = https://example.com/app
			// request = /key
			// result = https://example.com/app/

			const finalUrlString = cleanBaseUrl + suffix;
			const finalUrl = new URL(finalUrlString);

			// Append original query parameters
			url.searchParams.forEach((v, k) => {
				finalUrl.searchParams.append(k, v);
			});

			// Create a new request to forward
			const newRequest = new Request(finalUrl, {
				method: request.method,
				headers: request.headers,
				body: request.body,
				redirect: 'follow'
			});

			// Forward the request
			const response = await fetch(newRequest);

            // Return the response, creating a new Response object to ensure immutability issues don't occur
            // and to allow modification if needed (though we are just passing it through)
            return new Response(response.body, response);

		} catch (e) {
			return new Response(`Error constructing proxy request: ${e.message}`, { status: 500 });
		}
	},
};
