addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

// Set up a base URL where our production traffic lives
const productionHost = "bytesized.xyz"

// Rewrite production URLs in your response bodies
// This can effectively re-route external CDN content
// back through this same Workers function, allowing for more caching
const urlRewrites = {
  "myurl.com": "my-simple-cache.signalnerve.workers.dev",
}

const corsHeaders = {
  // TODO: This should be locked down to a specific origin in production
  'Access-Control-Allow-Origin': '*'
}

// Cache length for assets, in seconds
const expirationTtl = 60

// Set DEBUG to true to return error messages as the response
const DEBUG = false

async function handleRequest(request) {
  try {
    // Get URL from request and store it as an instance of URL
    // https://developer.mozilla.org/en-US/docs/Web/API/URL
    let url = new URL(request.url)

    // Replace the host in the original request with our production
    // host, which will route any requests to our production endpoints
    // e.g. "https://example.com/my-path" => "https://bytesized.xyz/my-path"
    url.host = productionHost

    // Get cached response based on URL from KV
    // e.g. "https://bytesized.xyz/tag/newsletter"
    const kvCachedResp = await SIMPLE_CACHE.getWithMetadata(url.toString())

    if (kvCachedResp && kvCachedResp.value) {
      const { value, metadata } = kvCachedResp

      // Construct a new response with the body, headers, and status/statusText from KV
      const cachedResp = new Response(value, { headers: metadata.headers })
      return cachedResp
    } else {
      // Get response from production
      const resp = await fetch(url.toString())

      // Clone the response into a new variable so we can query and modify it
      const cloneResp = resp.clone()
      let body

      if (cloneResp.headers.get('Content-type').includes('text')) {
        let textBody = await cloneResp.text()

        // If any URL Rewrites are set, iterate through them, and replace
        // any found hosts with the new host
        if (Object.keys(urlRewrites).length) {
          Object.keys(urlRewrites).forEach(key => {
            const pattern = new RegExp(key, 'gi')
            const newHost = urlRewrites[key]
            textBody = textBody.replace(pattern, newHost)
          })
        }
        body = textBody
      } else {
        body = cloneResp.body
      }

      // Prepare the response data to be persisted in KV
      // Cache the response in Workers KV, and expire it in a configured number of seconds 
      await SIMPLE_CACHE.put(
        url.toString(),
        body,
        {
          expirationTtl,
          metadata: {
            // Store a small amount of headers from the original response as KV metadata
            // This allows us to store the raw body as the value in KV, and the assets
            // as part of the KV metadata (which allows images and other non-text content
            // to exist in KV)
            // Note that KV metadata has a 1024 byte limit, so you must select a subset of
            // important response headers to store here
            headers: {
              'Content-type': cloneResp.headers.get('Content-Type'),
              'X-Workers-Simple-Cache': true,
            }
          }
        }
      )

      // Return the response to the client
      return new Response(textBody, cloneResp)
    }
  } catch (err) {
    if (DEBUG) {
      return new Response(err.toString(), { status: 500 })
    } else {
      return new Response("Something went wrong", { status: 500 })
    }
  }
}
