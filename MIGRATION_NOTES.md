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

The `win` launcher now includes a **Download Eagler browser backup** button. Use it from the original host browser profile before clearing site data. It downloads the `worlds` IndexedDB records and `_eaglercraftX` profile keys as a JSON diagnostic backup. Prefer the native Eagler world export, but keep this JSON as an additional copy. It may contain private world data and must not be committed to GitHub.

## Artifact inspection on 2026-09-11

The downloaded files were inspected:

- `EaglercraftX_1.8_u53.epk` begins with `EAGPKG$$` and identifies itself as `EaglercraftX 1.8 u53`; it is the client archive downloaded from the boot menu, not a saved world.
- `eagler-browser-backup-2026-09-11T03-35-37-563Z.json` is valid, but its `worlds` IndexedDB database has no object stores and therefore no saved world records or player files.
- The backup's `_eaglercraftX.p` profile data contains the skin username `son_im_VERY_sad`, not `win` player data.
- The `_eaglercraftX.s` server list contains `son`; `_eaglercraftX.r` contains relay URLs. These are launcher settings only.
- Searching the backup found no `playerdata`, `level.dat`, `region/`, `OfflinePlayer:`, or NBT records.

Conclusion: these downloads cannot recover the inventory. They prove the launcher/profile origin was captured, but that origin had no local Eagler world database. The next recovery attempt must use the exact browser profile and origin where the shared world was hosted, then export the world from the in-game world menu. If the world was hosted by another friend, that friend's browser profile is the one that must be backed up.

## Recovered EPK migration on 2026-09-11

The newly supplied EPK extraction is the actual Eagler world. Its layout is:

```text
finally/level.dat
finally/level0/
finally/level-1/
finally/player/<lowercase-eagler-name>.dat
finally/stats/<EaglerName>.json
```

The recovered `finally/player/son_im_very_sad.dat` contains 30 inventory entries, XP level 3, position `[138.7, 65, 67.7]`, and UUID fields. Eagler stores these files in `player/`, not vanilla `playerdata/`.

The migration utility now supports this format:

```bash
npm run migrate-playerdata -- \
  --world /path/to/eagler-world \
  --old-name son_im_very_sad \
  --new-name win \
  --eagler-world
```

This was run successfully into a separate copy named `son-migrated/`. It created:

```text
son-migrated/playerdata/661d7291-0125-3801-b1b2-56490e2cbf91.dat
```

That UUID is the offline UUID for `win`. The converted file was parsed successfully after writing and retained all 30 inventory entries, XP, position, and the rewritten target UUID. The original `son/` and `finally/` directories were not modified.

Before uploading, make sure the proxy account is registered with exactly `win`, or change `--new-name` and rerun against a fresh world copy. Upload `son-migrated` as the Aternos world ZIP; do not upload the EPK directly.

## Automatic no-loss registration

The proxy defaults to `PRESERVE_LEGACY_PLAYERDATA=true`. This is the desired mode when friends choose arbitrary account names: after `shafi_the_bomber` registers as `shafi`, Aternos still receives `shafi_the_bomber` and loads the original UUID/inventory. Nobody needs to register as `win`; `win` was only a temporary test migration target.

The title overlay says `REGISTER / LOGIN REQUIRED` while the world is loading. Terrain must still be sent so the Eagler client can reach the chat screen; client gameplay packets remain blocked until authentication succeeds. Upload a world containing the original legacy playerdata UUIDs when using this mode.

For the current recovered player, `son-legacy-upload.zip` was created locally with:

```text
playerdata/43e4635b-46e4-3797-ad43-d4f6f20c2cf8.dat
```

That is the UUID for `son_im_VERY_sad`, matching the Aternos log. Upload this legacy package to Aternos, then the player can register as any available name, for example `/register myname password`; the proxy will still connect Aternos as `son_im_VERY_sad` and load the inventory.

## Security/deployment reminder

Do not commit `data/accounts/accounts.json`, `data/players.txt`, passwords, browser IndexedDB dumps, or world backups. Account data needs persistent storage on the deployment host; an ephemeral Render filesystem can lose it after a restart or redeploy.