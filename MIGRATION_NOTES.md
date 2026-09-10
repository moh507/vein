# Migration Handoff

Date: 2026-09-10

## Current finding

The linked repository `https://github.com/moh507/win.git` could not be read from this environment:

- GitHub API returned `404 Not Found`.
- Git clone returned `403 Write access to repository not granted`.
- No local copy of the repository exists under `/workspaces` or `/tmp`.

This usually means the repository is private or the current GitHub credential does not have access.

## What is needed next

Either make the repository temporarily readable, or upload/clone it into the workspace. The useful files are the Eagler client source/build and any exported world archive. Search the repository for:

```text
playerdata
IndexedDB
worldsDB
EPK
SharedWorld
OfflinePlayer
localStorage
player.dat
```

An actual old world export is more valuable than the client source. Extract it and check for:

```text
level.dat
playerdata/<uuid>.dat
region/
```

## Existing migration command

Once an old player file exists, run from this repository:

```bash
npm run migrate-playerdata -- \
  --world /path/to/extracted/world \
  --old-name win \
  --new-name RegisteredName
```

The command maps the offline UUID derived from `win` to the offline UUID derived from `RegisteredName`, preserving the complete NBT player file. It does not create data if the source `.dat` file is absent.

## Important limitation

The checked-in `son` world has no `playerdata` directory and no `Player` compound in `level.dat`. The original Eagler host browser or a backup/export containing the old player state is required to recover inventory.

## Findings from `moh507/win`

The public `win` repository was inspected on 2026-09-10. It is not the original Eagler source or a world backup. It contains a bundled Eagler client in `index.html`, a basic HTTP/WebSocket dashboard, and a relay pass-through at `/relay`.

Confirmed from the embedded client:

- Worlds use the IndexedDB database named `worlds` (`worldsDB: "worlds"`).
- The default browser local-storage namespace is `_eaglercraftX`.
- The client contains an EPK/world converter and recognizes `playerdata/`, `stats/`, `data/`, and region directories when importing/exporting worlds.
- The bundle contains server-side player routines such as `readPlayerDataFromFile`, `readPlayerData`, and `writePlayerData`.
- The `win` relay proxy only forwards WebSocket frames to public relays. It does not save worlds, player NBT, or cookies.

## Best recovery procedure

Use the exact browser profile and website that hosted the shared world, not the `win` repository:

1. Open the Eagler page from `win` (`index.html`) through HTTP, using the same browser profile/device that hosted the world.
2. Confirm the world appears in the Eagler singleplayer/shared-world menu. Do not clear site data or use private browsing.
3. Use Eagler's world menu to export/download the world, preferably as EPK or as a vanilla ZIP.
4. Extract the export and check for `playerdata/`. The host's export is the only likely source for guest inventories.
5. Copy the extracted world somewhere safe before editing it.
6. Run `npm run migrate-playerdata -- --world /path/to/world --old-name win --new-name RegisteredName`.
7. Verify the command reports a successful copy before uploading the world to Aternos.

If the world is not listed in that browser, inspect browser DevTools under Application/Storage > IndexedDB > `worlds`. Do not edit records manually unless the Eagler export menu is unavailable; the records are filesystem chunks, not necessarily a directly usable ZIP. If the browser profile or host world is gone, the `win` relay cannot reconstruct the missing inventory.

## Security/deployment reminder

Do not commit `data/accounts/accounts.json`, `data/players.txt`, passwords, browser IndexedDB dumps, or world backups. Account data needs persistent storage on the deployment host; an ephemeral Render filesystem can lose it after a restart or redeploy.