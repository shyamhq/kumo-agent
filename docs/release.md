# Release

kumo-agent ships as a GitHub Release that Kumo's app catalogue installs. Nothing is published to
npm, app stores or a website, and there are no release workflows: a release is four steps, run by
hand from `main`.

## Version

Releases are `X.Y.Z-kumo.N`: `X.Y.Z` is the Paseo version the fork started from, and `N` counts
kumo-agent releases on it. Upstream never publishes a `-kumo.N` version, so npm can never swap in
upstream code. Natively it numbers like a beta of `X.Y.Z` (`packages/app/native-release-version.js`).

## Steps

1. **Bump the version** on a branch from `main`, then open a PR, have it reviewed and merge it:

   ```bash
   npm version X.Y.Z-kumo.N --no-git-tag-version --ignore-scripts
   node scripts/sync-workspace-versions.mjs
   npm install --package-lock-only --ignore-scripts
   ```

   Every changed line is the old version swapped for the new one, and no file names the old one.

2. **Pack the seven packages** from the merged `main` with `node_modules/.bin` on `PATH`:
   `highlight`, `relay`, `protocol`, `client`, `plugin`, `server` and `cli`.

   ```bash
   for w in highlight relay protocol client plugin server cli; do
     npm pack --workspace=@getpaseo/$w --pack-destination <dir>
   done
   ```

   The server's `prepack` builds the web UI and copies the built-in plugins into the tarball. If any
   pack fails, stop: nothing has been published yet.

3. **Publish the GitHub Release** `vX.Y.Z-kumo.N` on that commit with all seven tarballs attached:

   ```bash
   gh release create vX.Y.Z-kumo.N <dir>/*.tgz --repo shyamhq/kumo-agent --target <sha>
   ```

   Check that the server and CLI tarballs download.

4. **Point Kumo at it.** Set `version` in the kumo-agent row of Kumo's app catalogue (`PUT
/admin/box-apps` on the control plane, staging first) and read it back. Its install line installs
   all seven tarballs from the release in one `npm install`. A computer picks the new version up
   when its owner presses Update in the Apps window.

## Mobile

Upstream's app-store release (EAS workflows, Fastlane, store screenshots) is removed: it shipped
Paseo's app, and a Kumo mobile app will have its own. The EAS build profiles in
`packages/app/eas.json` stay for development builds.
