# FrisFrame desktop signing

FrisFrame keeps pull-request and ordinary `main` builds unsigned so they remain easy to test. The exact production tag `v<package-version>` is treated as a signed production release. The matching beta tag `v<package-version>-beta` is an intentionally unsigned GitHub prerelease for early testing.

No certificate, private key, password, Apple credential, or token belongs in the repository. Store all production signing material as GitHub Actions repository secrets.

## Beta prerelease policy

For package version `0.6.0`, the allowed unsigned beta tag is exactly `v0.6.0-beta`.

A beta tag:

- builds the Apple Silicon DMG and ZIP without Developer ID signing or notarization;
- builds the Windows x64 NSIS installer without Authenticode signing;
- still runs the normal source, package, runtime, and desktop verification steps;
- publishes the resulting assets as a GitHub **Prerelease**;
- does not require the seven production signing secrets.

Unsigned beta builds can trigger platform security warnings. On macOS, users may see an unidentified-developer or Gatekeeper warning. On Windows, users may see a Microsoft Defender SmartScreen warning. Beta prereleases are intended for testing before production signing is configured.

The beta exception is deliberately narrow. A production tag such as `v0.6.0` never falls back to unsigned packaging.

## macOS · Developer ID + notarization

Required repository secrets for production releases:

- `MAC_CSC_LINK` — base64-encoded Developer ID Application `.p12` certificate, or another `CSC_LINK` value accepted by electron-builder.
- `MAC_CSC_KEY_PASSWORD` — password protecting that certificate.
- `APPLE_ID` — Apple ID used for notarization.
- `APPLE_APP_SPECIFIC_PASSWORD` — app-specific password for that Apple ID.
- `APPLE_TEAM_ID` — 10-character Apple Developer Team ID.

The production tagged build maps the certificate secrets to `CSC_LINK` / `CSC_KEY_PASSWORD`, enables `forceCodeSigning`, enables electron-builder notarization, and builds the Apple Silicon DMG and ZIP. The workflow then verifies the `.app` using `codesign`, Gatekeeper `spctl`, and `xcrun stapler validate` before uploading the artifact.

The package configuration keeps Hardened Runtime enabled. `identity` is intentionally not hard-coded; electron-builder discovers the Developer ID identity from the supplied certificate.

## Windows · Authenticode

Required repository secrets for production releases:

- `WIN_CSC_LINK` — Windows code-signing `.pfx`/`.p12` certificate accepted by electron-builder, commonly base64-encoded.
- `WIN_CSC_KEY_PASSWORD` — password protecting the certificate.

For production tags the workflow enables `forceCodeSigning`, builds the x64 NSIS installer, and checks both the installer and the packaged `FrisFrame.exe` with PowerShell `Get-AuthenticodeSignature`. A status other than `Valid` fails the release.

If a base64 Windows certificate is too large for the Windows environment, re-export the signing certificate without unnecessary intermediate certificates or switch `WIN_CSC_LINK` to a secure HTTPS certificate location supported by electron-builder.

## Add the secrets

In the GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret** and add the five macOS secrets and two Windows secrets listed above.

Do not paste the actual secret values into an issue, pull request, workflow file, README, commit message, or chat transcript.

## Production release preflight

Before creating a production tag, run **Actions → Release preflight → Run workflow** on `main` and enter the intended tag, for example `v0.6.0`.

The preflight checks only production release metadata and whether all seven required signing secrets are present. It never prints secret values. It also requires the requested tag to equal `v` plus the version in `package.json`.

Passing the preflight proves that the required secret entries exist, but it does not prove that the certificates or Apple credentials are valid. The tagged production build remains the final authority because it performs the actual signing, notarization, and signature verification.

The unsigned `-beta` prerelease path intentionally does not use this production signing preflight.

## Beta release flow

1. Merge a fully tested change into `main`.
2. Create and push the exact beta tag matching `package.json`, such as `v0.6.0-beta` for package version `0.6.0`.
3. `Desktop builds` verifies the beta tag against `package.json`.
4. macOS and Windows packages are built unsigned but still pass normal package/runtime verification.
5. `Publish GitHub Release` creates or updates a GitHub Prerelease and uploads the DMG/ZIP/EXE assets.

## Production release flow

1. Merge a fully tested change into `main`.
2. Run `Release preflight` on `main` with the intended production tag and require it to pass.
3. Create and push the exact production tag matching `package.json`, such as `v0.6.0` for package version `0.6.0`.
4. `Desktop builds` independently re-checks that the Git tag matches `package.json` before any production package is built.
5. The macOS job signs, notarizes, and validates the app.
6. The Windows job signs and validates the installer and executable.
7. Only if both jobs succeed does `Publish GitHub Release` upload the DMG/ZIP and EXE.

A missing or invalid production signing secret intentionally fails the production tagged build instead of publishing an unsigned installer.
