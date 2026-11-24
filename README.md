# kumo-agent

kumo-agent is the coding-agent app of [Kumo](https://kumo.computer), the computer in the cloud for you,
your team and your AI agents. It runs Claude Code, Codex, OpenCode and other agents on a Kumo
computer, with sessions, worktrees, an editor, terminals, diffs and pull requests in one window, and
it opens as the **Agents** window inside Kumo OS.

It is a hard fork of [Paseo](https://github.com/getpaseo/paseo) by Mohamed Boudra. It has its own
team, goals and releases: there are no merges from upstream, and changes worth having are
re-implemented here.

## How it runs under Kumo

- Each Kumo computer installs kumo-agent from Kumo's app catalogue and runs its daemon as a Kumo
  app. Kumo's sign-in gate sits in front of it, so there is no pairing, relay or password to set up.
- Kumo OS shows the daemon's web UI in a window. The page connects back to the daemon that served
  it, and names the host by the computer's handle.
- Kumo gives agents its own instructions and MCP servers, and the AI keys the owner saved in Kumo.

[CLAUDE.md](CLAUDE.md) has the details, including what was cut for Kumo.

## Repository map

- `packages/server`: the daemon (agent processes, WebSocket API, MCP server, built-in web UI)
- `packages/app`: the Expo client (web, iOS, Android)
- `packages/cli`: the CLI, installed as `kumo-agent`
- `packages/desktop`: the Electron desktop app
- `packages/relay`: relay transport and encryption (off under Kumo)
- `plugins/`: built-in plugins, including `kumo`

## Development

```bash
npm run dev          # all local dev services
npm run dev:server
npm run dev:app
npm run build:server
npm run typecheck
```

Releases are versioned `X.Y.Z-kumo.N` and published as GitHub Releases: see
[docs/release.md](docs/release.md).

## License

Apache-2.0, as Paseo. See [LICENSE](LICENSE).
