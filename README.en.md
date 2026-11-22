# opencode-magpie-sync

**v0.1.0** for **OpenCode 2.3.2**. A server plugin that discovers a remote Magpie catalog and registers one `magpie` provider in OpenCode's native `/models` picker.

Windows OpenCode can connect to Linux Magpie over Ethernet. No Windows Magpie installation or manually maintained model IDs is required.

[中文](README.md)

## Install

Tested on Windows with Node.js 24.22.1 and OpenCode 2.3.2. Development tools support the Node.js ranges specified in package.json. The SDK is pinned to 2.3.2.

```powershell
npm ci
npm run check:package
```

Use `opencode debug paths` to locate the server configuration. Merge the following entry into `plugins` in `opencode.json`, replacing the package path and Gateway Key:

```json
{
  "plugins": [
    {
      "package": "file:///C:/plugins/opencode-magpie-sync",
      "options": {
        "baseURL": "http://192.168.22.100:3425/v1",
        "gatewayKey": "REPLACE_WITH_MAGPIE_GATEWAY_KEY",
        "refreshSeconds": 30,
        "timeoutMs": 5000
      }
    }
  ]
}
```

The package exports compiled `dist/index.js`; rebuild after source changes. This is a server-only plugin and needs no `cli.json` entry. Run `opencode service restart`, or restart your standalone process. No public npm release is claimed.

## Use

Open `/models`, select a model under **Magpie Gateway**, and send a message. Display names use Magpie's full label, such as `Seed-2.1-Turbo · Trae CN`. Nested routing IDs remain unchanged on the wire.

A nonempty `options.gatewayKey` takes precedence over the server process environment variable `MAGPIE_GATEWAY_KEY`. Both discovery and inference use the same source. JSON credentials are plaintext and belong only in your local user configuration.

Discovery polls every 30 seconds by default. Failures preserve the last valid in-memory catalog; two consecutive valid empty responses clear it. Reordering alone does not reload the registry. Requests preserve URL path prefixes and reject redirects.

## Scope and validation

Version 0.1.0 uses the OpenAI-compatible Chat route, declares text input/output and disables tools. A real Linux gateway returned 96 models, all matched OpenCode's list, and one model completed a real text-generation test. Full labels also matched all 96 models. Live TUI propagation after catalog changes, real network-disconnection recovery and other protocols remain unverified.

Run `npm run check`, `npm test` and `npm run check:package` for local checks. See [development](docs/DEVELOPMENT.md) for mock-host and optional live tests.

Detailed Chinese documentation covers [operations](docs/OPERATIONS.md), [architecture](docs/ARCHITECTURE.md), [configuration](docs/CONFIGURATION.md), [troubleshooting](docs/TROUBLESHOOTING.md), [releases](docs/RELEASING.md), [validation](docs/VALIDATION.md) and [dependency review](docs/DEPENDENCY-REVIEW.md).
