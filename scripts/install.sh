#!/usr/bin/env bash
set -euo pipefail

# Archimedes Agent Linux/macOS installer.
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Shashank-H/archimedes-agent/main/scripts/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/Shashank-H/archimedes-agent/main/scripts/install.sh | bash -s -- --beta
# Optional flags:
#   --beta                         Install the newest published release, including prereleases.
# Optional environment variables:
#   ARCHIMEDES_VERSION=v0.1.0      Install a specific release tag instead of latest.
#   ARCHIMEDES_REPO=owner/repo     Override the GitHub repository.
#   ARCHIMEDES_INSTALL_DIR=~/.local/bin AppImage install directory on Linux fallback installs.

APP_NAME="Archimedes Agent"
REPO="${ARCHIMEDES_REPO:-Shashank-H/archimedes-agent}"
VERSION="${ARCHIMEDES_VERSION:-latest}"
INSTALL_DIR="${ARCHIMEDES_INSTALL_DIR:-$HOME/.local/bin}"
BETA=false
TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t archimedes-install)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

log() {
  printf '\033[1;34m==>\033[0m %s\n' "$*" >&2
}

warn() {
  printf '\033[1;33mWARN:\033[0m %s\n' "$*" >&2
}

fail() {
  printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2
  exit 1
}

usage() {
  cat >&2 <<EOF
Usage: install.sh [--beta]

Options:
  --beta      Install the newest published release, including prereleases.
  -h, --help  Show this help message.
EOF
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --beta) BETA=true ;;
      -h|--help) usage; exit 0 ;;
      *) fail "Unknown option: $1" ;;
    esac
    shift
  done
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

sudo_if_needed() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif has_cmd sudo; then
    sudo "$@"
  else
    fail "This install path requires root privileges. Re-run with sudo or install an AppImage fallback."
  fi
}

github_api_get() {
  curl -fsSL \
    -H 'Accept: application/vnd.github+json' \
    -H 'User-Agent: archimedes-agent-installer' \
    "$1"
}

fetch_release_json() {
  local api_url
  if [ "$VERSION" = "latest" ]; then
    if [ "$BETA" = true ]; then
      api_url="https://api.github.com/repos/$REPO/releases?per_page=1"
      log "Reading newest published release metadata, including prereleases, from $api_url"
      github_api_get "$api_url"
      return 0
    fi

    api_url="https://api.github.com/repos/$REPO/releases/latest"
    log "Reading latest stable release metadata from $api_url"
    github_api_get "$api_url"
  else
    api_url="https://api.github.com/repos/$REPO/releases/tags/$VERSION"
    log "Reading release metadata from $api_url"
    github_api_get "$api_url"
  fi
}

asset_urls() {
  # GitHub browser_download_url values do not contain unescaped double quotes, so this
  # lightweight parser avoids requiring jq on fresh machines. The releases-list API
  # returns minified JSON, so do not rely on one field per line.
  grep -o '"browser_download_url":"[^"]*"' "$1" | sed 's/^"browser_download_url":"//; s/"$//'
}

pick_asset_url() {
  local release_json="$1"
  shift

  local urls pattern url
  urls="$(asset_urls "$release_json")"

  for pattern in "$@"; do
    url="$(printf '%s\n' "$urls" | grep -Ei "$pattern" | head -n 1 || true)"
    if [ -n "$url" ]; then
      printf '%s\n' "$url"
      return 0
    fi
  done

  return 1
}

download_asset() {
  local url="$1"
  local filename="$2"
  local output="$TMP_DIR/$filename"

  log "Downloading $(basename "$filename")"
  curl -fL --progress-bar \
    -H 'Accept: application/octet-stream' \
    -H 'User-Agent: archimedes-agent-installer' \
    "$url" -o "$output"

  printf '%s\n' "$output"
}

install_deb() {
  local file="$1"
  log "Installing Debian package"
  if has_cmd apt-get; then
    sudo_if_needed apt-get install -y "$file"
  elif has_cmd apt; then
    sudo_if_needed apt install -y "$file"
  elif has_cmd dpkg; then
    sudo_if_needed dpkg -i "$file" || {
      warn "dpkg reported missing dependencies; attempting apt-get -f install"
      sudo_if_needed apt-get install -f -y
    }
  else
    fail "No Debian package manager found."
  fi
}

install_rpm() {
  local file="$1"
  log "Installing RPM package"
  if has_cmd dnf; then
    sudo_if_needed dnf install -y "$file"
  elif has_cmd yum; then
    sudo_if_needed yum install -y "$file"
  elif has_cmd zypper; then
    sudo_if_needed zypper --non-interactive install "$file"
  elif has_cmd rpm; then
    sudo_if_needed rpm -Uvh "$file"
  else
    fail "No RPM package manager found."
  fi
}

install_appimage() {
  local file="$1"
  mkdir -p "$INSTALL_DIR"
  local appimage="$INSTALL_DIR/archimedes-agent.AppImage"
  local launcher="$INSTALL_DIR/archimedes"

  log "Installing AppImage to $appimage"
  cp "$file" "$appimage"
  chmod +x "$appimage"

  cat > "$launcher" <<EOF
#!/usr/bin/env sh
exec "$appimage" "\$@"
EOF
  chmod +x "$launcher"

  if ! printf '%s' ":$PATH:" | grep -Fq ":$INSTALL_DIR:"; then
    warn "$INSTALL_DIR is not on PATH. Add it to your shell profile to run 'archimedes' from a terminal."
  fi

  log "Installed launcher: $launcher"
}

install_macos_dmg() {
  local file="$1"
  local mount_point="$TMP_DIR/mnt"
  mkdir -p "$mount_point"

  log "Mounting DMG"
  hdiutil attach "$file" -mountpoint "$mount_point" -nobrowse -quiet

  local app_path
  app_path="$(find "$mount_point" -maxdepth 1 -name '*.app' -type d | head -n 1 || true)"
  [ -n "$app_path" ] || fail "No .app bundle found inside DMG."

  copy_macos_app "$app_path"
  hdiutil detach "$mount_point" -quiet || true
}

install_macos_archive() {
  local file="$1"
  local extract_dir="$TMP_DIR/app"
  mkdir -p "$extract_dir"

  log "Extracting macOS app archive"
  case "$file" in
    *.tar.gz|*.tgz) tar -xzf "$file" -C "$extract_dir" ;;
    *.zip) unzip -q "$file" -d "$extract_dir" ;;
    *) fail "Unsupported macOS archive: $file" ;;
  esac

  local app_path
  app_path="$(find "$extract_dir" -maxdepth 2 -name '*.app' -type d | head -n 1 || true)"
  [ -n "$app_path" ] || fail "No .app bundle found in archive."

  copy_macos_app "$app_path"
}

copy_macos_app() {
  local app_path="$1"
  local target_dir="/Applications"
  local target="$target_dir/$(basename "$app_path")"

  if [ ! -w "$target_dir" ]; then
    warn "$target_dir requires administrator privileges. You may be prompted for your password."
    sudo_if_needed rm -rf "$target"
    sudo_if_needed cp -R "$app_path" "$target_dir/"
  else
    rm -rf "$target"
    cp -R "$app_path" "$target_dir/"
  fi

  log "Installed $APP_NAME to $target"
}

main() {
  parse_args "$@"

  need_cmd curl
  need_cmd grep
  need_cmd sed

  local os arch release_json asset_url asset_file
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$arch" in
    x86_64|amd64) ;;
    arm64|aarch64)
      warn "Release pipeline currently publishes x64 builds. This installer will look for x64-compatible assets."
      ;;
    *) warn "Untested architecture: $arch" ;;
  esac

  local release_file="$TMP_DIR/release.json"
  fetch_release_json > "$release_file"
  release_json="$release_file"

  case "$os" in
    Linux)
      if has_cmd dpkg || has_cmd apt-get || has_cmd apt; then
        asset_url="$(pick_asset_url "$release_json" '\.deb($|\?)' 'linux.*\.deb($|\?)' || true)"
        if [ -n "$asset_url" ]; then
          asset_file="$(download_asset "$asset_url" archimedes-agent.deb)"
          install_deb "$asset_file"
        else
          warn "No .deb release asset found; falling back to AppImage."
        fi
      elif has_cmd rpm || has_cmd dnf || has_cmd yum || has_cmd zypper; then
        asset_url="$(pick_asset_url "$release_json" '\.rpm($|\?)' 'linux.*\.rpm($|\?)' || true)"
        if [ -n "$asset_url" ]; then
          asset_file="$(download_asset "$asset_url" archimedes-agent.rpm)"
          install_rpm "$asset_file"
        else
          warn "No .rpm release asset found; falling back to AppImage."
        fi
      fi

      if [ -z "${asset_file:-}" ]; then
        asset_url="$(pick_asset_url "$release_json" '\.AppImage($|\?)' 'appimage' || true)"
        [ -n "$asset_url" ] || fail "No Linux .deb, .rpm, or AppImage asset found in the selected release."
        asset_file="$(download_asset "$asset_url" archimedes-agent.AppImage)"
        install_appimage "$asset_file"
      fi
      ;;
    Darwin)
      need_cmd hdiutil
      asset_url="$(pick_asset_url "$release_json" '\.dmg($|\?)' 'macos.*\.dmg($|\?)' 'darwin.*\.dmg($|\?)' || true)"
      if [ -n "$asset_url" ]; then
        asset_file="$(download_asset "$asset_url" archimedes-agent.dmg)"
        install_macos_dmg "$asset_file"
      else
        asset_url="$(pick_asset_url "$release_json" '\.app\.tar\.gz($|\?)' 'macos.*\.(tar\.gz|zip)($|\?)' 'darwin.*\.(tar\.gz|zip)($|\?)' || true)"
        [ -n "$asset_url" ] || fail "No macOS .dmg, .app.tar.gz, or app .zip asset found in the selected release."
        case "$asset_url" in
          *.zip) asset_file="$(download_asset "$asset_url" archimedes-agent.zip)" ;;
          *) asset_file="$(download_asset "$asset_url" archimedes-agent.app.tar.gz)" ;;
        esac
        install_macos_archive "$asset_file"
      fi
      ;;
    *)
      fail "Unsupported OS: $os. Use scripts/install.ps1 on Windows."
      ;;
  esac

  log "$APP_NAME installation complete."
}

main "$@"
