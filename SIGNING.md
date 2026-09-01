# FrisFrame desktop signing

FrisFrame keeps pull-request and ordinary `main` builds unsigned so they remain easy to test. A `v*` Git tag is treated as a production release: both desktop jobs require signing credentials, verify the resulting signatures, and only then allow the GitHub Release job to publish the artifacts.

No certificate, private key, password, Apple credential, or token belongs in the repository. Store all of them as GitHub Actions repository secrets.

## macOS · Developer ID + notarization

Required repository secrets:

- `MAC_CSC_LINK` — base64-encoded Developer ID Application `.p12` certificate, or another `CSC_LINK` value accepted by electron-builder.
- `MAC_CSC_KEY_PASSWORD` — password protecting that certificate.
- `APPLE_ID` — Apple ID used for notarization.
- `APPLE_APP_SPECIFIC_PASSWORD` — app-specific password for that Apple ID.
- `APPLE_TEAM_ID` — 10-character Apple Developer Team ID.

The tagged build maps the certificate secrets to `CSC_LINK` / `CSC_KEY_PASSWORD`, enables `forceCodeSigning`, enables electron-builder notarization, and builds the Apple Silicon DMG and ZIP. The workflow then verifies the `.app` using `codesign`, Gatekeeper `spctl`, and `xcrun stapler validate` before uploading the artifact.

The package configuration keeps Hardened Runtime enabled. `identity` is intentionally not hard-coded; electron-builder discovers the Developer ID identity from the supplied certificate.

## Windows · Authenticode

Required repository secrets:

- `WIN_CSC_LINK` — Windows code-signing `.pfx`/`.p12` certificate accepted by electron-builder, commonly base64-encoded.
- `WIN_CSC_KEY_PASSWORD` — password protecting the certificate.

For tagged releases the workflow enables `forceCodeSigning`, builds the x64 NSIS installer, and checks both the installer and the packaged `FrisFrame.exe` with PowerShell `Get-AuthenticodeSignature`. A status other than `Valid` fails the release.

If a base64 Windows certificate is too large for the Windows environment, re-export the signing certificate without unnecessary intermediate certificates or switch `WIN_CSC_LINK` to a secure HTTPS certificate location supported by electron-builder.

## Add the secrets

In the GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret** and add the five macOS secrets and two Windows secrets listed above.

Do not paste the actual secret values into an issue, pull request, workflow file, README, commit message, or chat transcript.

## Release preflight

Before creating a production tag, run **Actions → Release preflight → Run workflow** on `main` and enter the intended tag, for example `v0.6.0`.

The preflight checks only release metadata and whether all seven required signing secrets are present. It never prints secret values. It also requires the requested tag to equal `v` plus the version in `package.json`.

Passing the preflight proves that the required secret entries exist, but it does not prove that the certificates or Apple credentials are valid. The tagged production build remains the final authority because it performs the actual signing, notarization, and signature verification.

## Release flow

1. Merge a fully tested change into `main`.
2. Run `Release preflight` on `main` with the intended tag and require it to pass.
3. Create and push the exact release tag matching `package.json`, such as `v0.6.0` for package version `0.6.0`.
4. `Desktop builds` independently re-checks that the Git tag matches `package.json` before any tagged package is built.
5. The macOS job signs, notarizes, and validates the app.
6. The Windows job signs and validates the installer and executable.
7. Only if both jobs succeed does `Publish GitHub Release` upload the DMG/ZIP and EXE.

A missing or invalid production signing secret intentionally fails the tagged build instead of publishing an unsigned installer.
