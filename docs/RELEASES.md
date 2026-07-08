# Releases

Archimedes desktop releases are built by GitHub Actions when you push a version tag.

## Supported tag format

Use a `v` prefix followed by a semantic version:

```txt
v1.2.3
v1.2.3-rc.1
```

The release workflow rejects tags that do not match `v<major>.<minor>.<patch>[-prerelease][+build]`.

## Main-branch requirement

Official releases must tag a commit that is already contained in `main`.

If a tag points to a commit outside `main`, the workflow fails before any release artifacts are published.

## What the workflow builds

For every valid release tag, GitHub Actions builds desktop bundles for:

- Windows (`x64`)
- Linux (`x64`)
- macOS (`x64`)

During CI, the workflow parses the version from the tag and injects it into:

- `package.json`
- `package-lock.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`

That keeps the packaged app metadata aligned with the tag version without requiring a version-bump commit before every release.

Uploaded workflow artifacts follow this naming pattern:

```txt
archimedes-agent-<platform>-<arch>-v<version>
```

The workflow also publishes the generated bundle files to the GitHub Release for the tag.

## Release steps

1. Start from an up-to-date `main`.
2. Run the standard production validation locally.
3. Create the version tag.
4. Push the tag to GitHub.

Example:

```bash
git checkout main
git pull --ff-only origin main
npm ci
npm run build
git tag v1.2.3
git push origin v1.2.3
```

## Install scripts

Release consumers can install the latest published desktop bundle directly from this repository.

Linux/macOS bash:

```bash
curl -fsSL https://raw.githubusercontent.com/Shashank-H/archimedes-agent/main/scripts/install.sh | bash
```

Current beta preview:

```bash
curl -fsSL https://raw.githubusercontent.com/Shashank-H/archimedes-agent/main/scripts/install.sh | bash -s -- --beta
```

Windows PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/Shashank-H/archimedes-agent/main/scripts/install.ps1 | iex"
```

Current beta preview:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((irm https://raw.githubusercontent.com/Shashank-H/archimedes-agent/main/scripts/install.ps1))) -Beta"
```

The scripts read GitHub Release metadata, pick the OS-specific asset, download it, and run the appropriate installer. Use `--beta` for `install.sh` or `-Beta` for `install.ps1` to install the newest published prerelease. Set `ARCHIMEDES_VERSION=v1.2.3` for `install.sh`, or pass `-Version v1.2.3` when running `install.ps1` from a downloaded file, to install a specific release.

## Inspecting results

After the tag push:

1. Open **GitHub Actions** and check the `Desktop Release` workflow run.
2. Download the workflow artifacts if you want the per-platform bundles directly from CI.
3. Open the GitHub Release for the same tag to download the published release assets.

## Future signing and notarization

This pipeline is intentionally unsigned for now. It leaves room to add future platform signing, notarization, and secret-based release steps without changing the release-tag flow.
