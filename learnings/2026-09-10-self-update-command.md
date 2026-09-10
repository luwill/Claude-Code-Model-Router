# A self-update command is mostly edge cases, and two of them are one-liners that bite

**Problem (one line):** Add `ccmr update`, "equivalent to `npm install -g claude-code-model-router@latest`" — where the interesting work is entirely in what happens *around* that install.

## Approach

1. **Split the network lookup from the decision from the install.** `fetchLatestVersion` (registry I/O), `compareVersions` + `planUpdate` (pure), `installLatest` (process spawn). Only the middle pair holds the logic worth protecting, and being pure they test without network, npm, or mocks.
2. **Test the registry call against a local HTTP server, never the real registry.** Same pattern the repo already uses for upstream providers: a `http.createServer` stub on port 0 covering the 200, the 503, and the malformed-payload paths. Fast, offline, deterministic.
3. **Compare versions numerically, and say why in the test.** String comparison puts `1.9.0` above `1.10.0`, which would tell a user on 1.9.0 they were current — the exact failure a naive `latest !== current` or `latest > current` produces. The test names that bug so nobody "simplifies" it back.
4. **Treat a local build ahead of the registry as up to date.** This repo routinely runs unpublished versions (1.19.0 locally while npm had 1.18.0), so a plain "differs → install" rule would silently *downgrade* the developer. This was not hypothetical: it is exactly what the first real `--check` run hit, which is also how it got verified.
5. **Constrain anything that becomes argv[0].** `--package-manager` is spawned as a command name, so it is checked against a four-entry whitelist rather than forwarded; the package name and `@latest` are literals, and the spawn uses an argv array with `shell: false`. Verified by passing `rm -rf /` and watching it be refused.
6. **Say what the upgrade does not do.** A package upgrade is not config hot-reload: gateways already running keep serving the old code. The command discovers them, prints which ports are stale, and tells the user how to restart — without stopping processes it does not own.

## Judgment calls

- **No `--force`.** Reinstalling an identical version only helps a corrupted install, which is rare enough to leave to a manual npm command; adding it would also give the downgrade path a way back in.
- **`stdio: 'inherit'` instead of capturing output.** npm's permission errors (`EACCES`, prefix problems) are the whole diagnosis in the failure case, and paraphrasing them is how this repo has burned time before.
- **Registry over `npm view`.** The built-in `fetch` needs no dependency and no npm subprocess just to read one field, and it keeps the check working even where npm is slow or misconfigured.
- **CLI action left untested.** It calls `process.exit` and spawns npm; the repo's agreed seams are ConfigManager / ModelRouter / HTTP endpoints, so the logic lives in tested pure functions and the wiring was exercised by running `update --help`, `--check`, and the whitelist rejection for real.

## Reusable rule

For any self-update path, the two rules that are one line each and non-obvious: compare versions numerically, and treat "local is newer" as up to date — otherwise the command will confidently downgrade the person most likely to run it, the developer on an unpublished build.
