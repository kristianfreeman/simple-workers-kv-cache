# Simple Workers KV Cache

Example project for caching production HTML pages, and serving them from Cloudflare's edge, using Workers KV.

## Installation

```
$ wrangler generate https://github.com/signalnerve/simple-workers-kv-cache
```

## Configuration

1. Configure `account_id` and `kv_namespaces` in `wrangler.toml` by providing account-specific information.
2. Update `productionHost` to a known production host that you'd like to proxy and cache traffic from
3. Customize `expirationTtl` to a number of seconds to cache data for. _Note: this value must be 60 seconds or longer._
4. (Optionally) Set `DEBUG` to `true` to have error messages returned from the Workers function.