<#
.SYNOPSIS
  Installs Archimedes Agent for Windows from the latest GitHub Release.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/Shashank-H/archimedes-agent/main/scripts/install.ps1 | iex"

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((irm https://raw.githubusercontent.com/Shashank-H/archimedes-agent/main/scripts/install.ps1))) -Beta"

.PARAMETER Version
  Optional release tag, for example v0.1.0. Defaults to the latest release.

.PARAMETER Repo
  GitHub repository in owner/name form. Defaults to Shashank-H/archimedes-agent.

.PARAMETER Beta
  Installs the newest published release, including prereleases.

.PARAMETER Silent
  Runs the installer non-interactively when the selected release asset supports it.
#>

param(
  [string]$Version = "latest",
  [string]$Repo = "Shashank-H/archimedes-agent",
  [switch]$Beta,
  [switch]$Silent
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Step {
  param([string]$Message)
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Warn {
  param([string]$Message)
  Write-Host "WARN: $Message" -ForegroundColor Yellow
}

function Fail {
  param([string]$Message)
  Write-Host "ERROR: $Message" -ForegroundColor Red
  exit 1
}

function Invoke-GitHubApi {
  param([string]$Uri)

  Invoke-RestMethod -Uri $Uri -Headers @{
    Accept = "application/vnd.github+json"
    "User-Agent" = "archimedes-agent-installer"
  }
}

function Get-Release {
  param([string]$Repository, [string]$ReleaseVersion, [switch]$IncludePrerelease)

  if ($ReleaseVersion -eq "latest") {
    if ($IncludePrerelease) {
      $uri = "https://api.github.com/repos/$Repository/releases?per_page=1"
      Write-Step "Reading newest published release metadata, including prereleases, from $uri"
      $releases = @(Invoke-GitHubApi -Uri $uri)
      if ($releases.Count -eq 0) {
        Fail "No published releases found for $Repository."
      }
      return $releases[0]
    }

    $uri = "https://api.github.com/repos/$Repository/releases/latest"
    Write-Step "Reading latest stable release metadata from $uri"
    return Invoke-GitHubApi -Uri $uri
  } else {
    $uri = "https://api.github.com/repos/$Repository/releases/tags/$ReleaseVersion"
    Write-Step "Reading release metadata from $uri"
    return Invoke-GitHubApi -Uri $uri
  }
}

function Select-WindowsAsset {
  param($Release)

  $assets = @($Release.assets)
  if ($assets.Count -eq 0) {
    Fail "The selected release has no downloadable assets."
  }

  $patterns = @(
    '*setup*.exe',
    '*.exe',
    '*.msi'
  )

  foreach ($pattern in $patterns) {
    $match = $assets |
      Where-Object { $_.name -like $pattern -and $_.name -notlike '*.sig' -and $_.name -notlike '*.zip' } |
      Select-Object -First 1
    if ($null -ne $match) {
      return $match
    }
  }

  Fail "No Windows .exe or .msi installer asset found in release $($Release.tag_name)."
}

function Download-Asset {
  param($Asset, [string]$DestinationDirectory)

  $destination = Join-Path $DestinationDirectory $Asset.name
  Write-Step "Downloading $($Asset.name)"
  Invoke-WebRequest -Uri $Asset.browser_download_url -OutFile $destination -Headers @{
    Accept = "application/octet-stream"
    "User-Agent" = "archimedes-agent-installer"
  }
  return $destination
}

function Install-Asset {
  param([string]$Path, [switch]$SilentInstall)

  $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()

  if ($extension -eq ".msi") {
    Write-Step "Starting MSI installer"
    $arguments = @('/i', "`"$Path`"")
    if ($SilentInstall) {
      $arguments += @('/passive', '/norestart')
    }
    $process = Start-Process -FilePath "msiexec.exe" -ArgumentList $arguments -Wait -PassThru
  } elseif ($extension -eq ".exe") {
    Write-Step "Starting Windows installer"
    if ($SilentInstall) {
      # Tauri NSIS installers support /S for silent mode.
      $process = Start-Process -FilePath $Path -ArgumentList '/S' -Wait -PassThru
    } else {
      $process = Start-Process -FilePath $Path -Wait -PassThru
    }
  } else {
    Fail "Unsupported Windows installer type: $extension"
  }

  if ($process.ExitCode -ne 0) {
    Fail "Installer exited with code $($process.ExitCode)."
  }
}

try {
  if (-not $IsWindows -and $PSVersionTable.PSVersion.Major -ge 6) {
    Fail "This PowerShell installer is for Windows. Use scripts/install.sh on macOS or Linux."
  }

  $release = Get-Release -Repository $Repo -ReleaseVersion $Version -IncludePrerelease:$Beta
  $asset = Select-WindowsAsset -Release $release
  $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("archimedes-install-" + [System.Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $tempDir | Out-Null

  try {
    $installer = Download-Asset -Asset $asset -DestinationDirectory $tempDir
    Install-Asset -Path $installer -SilentInstall:$Silent
  } finally {
    Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
  }

  Write-Step "Archimedes Agent installation complete."
} catch {
  Fail $_.Exception.Message
}
