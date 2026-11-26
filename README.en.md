# opencode-magpie-sync

**OpenCode 2.4.2** · plugin **v0.1.0** · MIT · server-side plugin only

Synchronises a remote Magpie gateway's `/v1/models` catalog into OpenCode as a native model provider. Once installed, Magpie models appear directly in the `/models` picker, so every workstation no longer needs a hand-maintained list of model IDs.

Typical deployment: OpenCode on Windows reaches Magpie on Linux over a private network, and model changes stay managed on the Magpie side.

[中文](README.md) · [Documentation index](docs/README.md) · [Architecture](docs/ARCHITECTURE.md) · [Configuration](docs/CONFIGURATION.md) · [Deployment runbook](docs/DEPLOYMENT.md)

---

## Capabilities

| Capability | Behaviour |
| --- | --- |
| Single provider | Registers one `magpie` provider shown as **Magpie Gateway** |
| Automatic discovery | Polls `<baseURL>/models` every 30 seconds by default (10–3600 s) |
| Native picker | Models appear in `/models`; selection IDs are `magpie/<original model ID>` |
| Full labels | Prefers Magpie `magpie_label`, preserving group names |
| Transparent routing | The request `model` field keeps the original Magpie ID, including nested slashes |
| Failure retention | A failed refresh keeps the last valid in-memory catalog and retries |
| Empty-catalog debounce | Two consecutive *valid* empty responses are required to clear the catalog |
| Credential isolation | The bearer key lives only in plugin memory or the server environment, never in provider metadata or logs |
| Tight boundaries | Discovery rejects redirects and caps timeout/size; inference verifies target origin and path prefix |
| No persistence | No database, no disk cache, no telemetry; restart triggers a fresh discovery |

## Requirements

| Item | Requirement |
| --- | --- |
| OpenCode | **2.4.2** (this revision is adapted to that host; re-validate after upgrading) |
| Node.js | `^22.12.0`, `^24.0.0` or `>=26` for build/test; validated on 24.22.1 |
| Network | The OpenCode server process can reach the gateway host and port |
| Credentials | A Magpie Gateway Key allowed to read the catalog and use the intended models |
| Toolchain | TypeScript 5.9.3 and Vitest 5.1.1, pinned by `package-lock.json` |

## Install

### 1. Build the plugin

```powershell
npm ci
npm run check:package
```

`check:package` compiles TypeScript and verifies that Node can load the package entry. The host loads `dist/index.js`, so rebuild after source changes.

### 2. Configure OpenCode

Use `opencode debug paths` to locate the server configuration, then merge the entry below into `plugins` in `opencode.json`. Replace the package path, `baseURL` and Gateway Key:

```json
{
  "plugins": [
    {
      "package": "file:///C:/Users/YOUR_NAME/dev/opencode-magpie-sync",
      "options": {
        "baseURL": "http://192.0.2.10:3425/v1",
        "gatewayKey": "REPLACE_WITH_MAGPIE_GATEWAY_KEY",
        "refreshSeconds": 30,
        "timeoutMs": 5000
      }
    }
  ]
}
```

See [configuration](docs/CONFIGURATION.md) for every option, environment-variable credentials and URL rules. Sample file: [opencode.example.jsonc](opencode.example.jsonc).

### 3. Restart the host

```powershell
opencode service restart
opencode service status
```

For `--standalone`, exit and relaunch that process. A rebuilt package is not hot-swapped into a running instance.

### 4. Verify the catalog

```powershell
opencode models
```

Expect `magpie/<original model ID>` entries. You can also open `/models` and inspect names and IDs under **Magpie Gateway**.

> Repository acceptance checks deliberately send **no chat or generation requests**. Validate generation separately against your own gateway.

## Configuration summary

| Option | Default | Meaning |
| --- | --- | --- |
| `baseURL` | required | Magpie gateway base URL, usually including `/v1`; proxy prefixes are preserved |
| `gatewayKey` | none | Non-empty value overrides the environment variable; stored as plaintext in local config |
| `refreshSeconds` | `30` | Catalog polling interval; integers are clamped to 10–3600 |
| `timeoutMs` | `5000` | Per-discovery timeout; integers are clamped to 1000–30000 |

Credentials may instead come from `MAGPIE_GATEWAY_KEY` in the server process environment. Either source covers both discovery and inference; a non-empty `options.gatewayKey` wins.

The URL must use `http` or `https` and must not contain embedded credentials, a query string or a fragment. Prefixes such as `/proxy/v1` are preserved; the plugin never rewrites or probes alternative paths.

## Model mapping

| Magpie field | OpenCode behaviour |
| --- | --- |
| `id` | Used verbatim as the wire model ID; selection adds the `magpie/` prefix |
| `magpie_label` | Preferred display name, including the Magpie group |
| `name` / `display_name` | Fallbacks when `magpie_label` is absent, then `id` |
| `type` | Accepts `chat`, `model` or no type; other string types are skipped |
| `context_window` | Positive safe integer becomes the context limit, otherwise `0` |
| `max_output_tokens` | Positive safe integer becomes the output limit, otherwise `0` |

Tools are disabled and the model declares text input/output only; cost is empty. Vision, tool calling, reasoning effort, pricing and alternative protocols are not mapped yet.

## Runtime behaviour

- **Refresh**: one discovery at load, then periodic polling. Overlapping triggers share one in-flight request.
- **Commit**: catalogs are sorted and signed; only ID, name or limit changes call `ctx.provider.reload()`. Reordering alone does not.
- **Failure**: HTTP, network, timeout and parse errors retain the current catalog; logs stay generic to avoid echoing sensitive responses.
- **Empty catalog**: with an existing catalog, one empty response is ignored; the second consecutive valid empty response commits the empty catalog.
- **Restart**: the catalog is memory-only. Offline startup begins empty and fills in after reconnection.
- **Unload**: clears the timer, awaits the bounded in-flight discovery, then disposes the auth hook and provider registration.

## Security boundaries

- The Gateway Key is never written into provider definitions, model metadata or logs; inference auth is injected by the host's final HTTP hook.
- Discovery uses `redirect: "error"`, a 5-second default timeout and an 8 MiB response cap.
- Inference requests verify target origin and configured path prefix before the bearer header is attached, and reject redirects again.
- The plugin does not scan networks, start Magpie, read unrelated credentials or upload telemetry.
- The endpoint is supplied by a trusted operator and may target private or loopback addresses; this is **not** a general SSRF or network-isolation control.
- Plain HTTP does not encrypt the link. Use a controlled HTTPS gateway or tunnel across untrusted networks.

See [SECURITY.md](SECURITY.md) for reporting and the threat model, and [dependency review](docs/DEPENDENCY-REVIEW.md) for supply-chain status.

## Validation status

This revision targets **OpenCode 2.4.2 / SDK 2.4.2** and has passed:

- strict TypeScript checking;
- **18/18** unit tests;
- package build and entry loading;
- a host check against a local mock catalog using real OpenCode 2.4.2, reporting **zero inference requests**.

This adaptation did **not** run model generation, a live Magpie session or a disconnect/reconnect drill. The historical 2.3.2 live record (real Linux gateway, 96 models, one text generation) is retained for traceability only and is not evidence for 2.4.2 inference. See [validation scope](docs/VALIDATION.md).

## Development

```powershell
npm run check          # strict TypeScript check
npm test               # Vitest unit tests
npm run check:package  # build + load package entry
npm run verify         # all three, in order
npm run test:host      # real host + localhost mock catalog (no inference)
```

The host smoke test needs an `opencode` executable, or `OPENCODE_BIN` pointing to one. See the [development guide](docs/DEVELOPMENT.md).

## Documentation

| Document | Audience |
| --- | --- |
| [Documentation index](docs/README.md) | Reading order and purpose of every document |
| [Architecture](docs/ARCHITECTURE.md) | Component boundaries, data flow, state machine and trade-offs |
| [Compatibility policy](docs/COMPATIBILITY.md) | Host/SDK version policy and upgrade procedure |
| [Configuration](docs/CONFIGURATION.md) | Options, credentials, URL and catalog policy |
| [Deployment](docs/DEPLOYMENT.md) | Production rollout, acceptance checklist and rollback |
| [Operations](docs/OPERATIONS.md) | Day-2 operations, change control, key rotation and decommissioning |
| [Development](docs/DEVELOPMENT.md) | Toolchain, test layers, debugging and code constraints |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Symptoms, causes, actions and escalation bundle |
| [Validation](docs/VALIDATION.md) | What is tested, what is not, and evidence boundaries |
| [Releasing](docs/RELEASING.md) | Versions, artifacts, checksums and release gates |
| [Dependency review](docs/DEPENDENCY-REVIEW.md) | Audit results, reachability and remediation policy |
| [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) | Collaboration and compliance |

The deep operational documentation is maintained in Chinese.

## Version policy

The plugin version is strictly fixed at **v0.1.0** (semver form `0.1.0` in `package.json`). Host adaptations, fixes, documentation and test updates never change it automatically; any version change requires explicit maintainer authorisation.

## License

[MIT](LICENSE). Commercial deployments must independently confirm the terms of Magpie, the upstream model services and transitive dependencies.

## Uninstall and rollback

Remove this plugin entry from `plugins` and restart the service or standalone process. To roll back, restore the previous package path and matching lockfile, rebuild, and restart. Keep gateway settings and credentials under your control. Starting the plugin fetches the configured gateway catalog; use `npm run test:host` for isolated localhost validation. Real catalog access requires separate authorization.
