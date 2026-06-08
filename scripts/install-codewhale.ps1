[CmdletBinding()]
param(
    [string]$Version = "0.8.53",
    [string]$InstallDir = "",
    [string]$Proxy = $(if ($env:DEEPSEEK_TIDE_PROXY) {
        $env:DEEPSEEK_TIDE_PROXY
    } elseif ($env:WHALETIDE_PROXY) {
        $env:WHALETIDE_PROXY
    } else {
        $env:CODETIDE_PROXY
    }),
    [string]$ReleaseBaseUrl = "https://github.com/Hmbown/CodeWhale/releases/download",
    [switch]$Force,
    [switch]$Configure
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

if (-not $InstallDir) {
    $InstallDir = Join-Path $PSScriptRoot "..\vendor\codewhale"
}

if (-not $Proxy) {
    foreach ($candidatePort in 7897, 7890, 10809, 1080) {
        $client = [Net.Sockets.TcpClient]::new()
        try {
            $connection = $client.ConnectAsync("127.0.0.1", $candidatePort)
            if ($connection.Wait(200) -and $client.Connected) {
                $Proxy = "http://127.0.0.1:$candidatePort"
                break
            }
        }
        catch {
            # Keep probing other common local proxy ports.
        }
        finally {
            $client.Dispose()
        }
    }
}

function Write-Step {
    param([string]$Message)
    Write-Host "[deepseek-tide] $Message" -ForegroundColor Cyan
}

if ($Proxy) {
    Write-Step "Using proxy $Proxy"
}

function Invoke-Download {
    param([string]$Uri, [string]$OutFile)

    $lastError = $null
    if (Get-Command python.exe -ErrorAction SilentlyContinue) {
        try {
            Write-Step "Downloading with Python/OpenSSL: $Uri"
            $downloadScript = Join-Path $PSScriptRoot "download.py"
            $pythonArguments = @($downloadScript, $Uri, $OutFile)
            if ($Proxy) {
                $pythonArguments += @("--proxy", $Proxy)
            }
            & python.exe @pythonArguments
            if ($LASTEXITCODE -eq 0 -and
                (Test-Path -LiteralPath $OutFile) -and
                (Get-Item -LiteralPath $OutFile).Length -gt 0) {
                return
            }
        }
        catch {
            $lastError = $_
        }
    }

    for ($attempt = 1; $attempt -le 4; $attempt++) {
        try {
            Write-Step "Downloading $Uri (attempt $attempt/4)"
            $parameters = @{
                Uri             = $Uri
                OutFile         = $OutFile
                UseBasicParsing = $true
                TimeoutSec      = 180
            }
            if ($Proxy) {
                $parameters.Proxy = $Proxy
            }
            Invoke-WebRequest @parameters
            if ((Get-Item -LiteralPath $OutFile).Length -le 0) {
                throw "Downloaded file is empty."
            }
            return
        }
        catch {
            $lastError = $_
            if (Test-Path -LiteralPath $OutFile) {
                Remove-Item -LiteralPath $OutFile -Force
            }
            Start-Sleep -Seconds ([Math]::Min(15, [Math]::Pow(2, $attempt)))
        }
    }

    if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
        Write-Step "Invoke-WebRequest failed; trying curl.exe"
        $arguments = @(
            "-fL",
            "--retry", "4",
            "--retry-all-errors",
            "--connect-timeout", "20",
            "--max-time", "600",
            "--output", $OutFile
        )
        if ($Proxy) {
            $arguments += @("--proxy", $Proxy)
        }
        $arguments += $Uri
        & curl.exe @arguments
        if ($LASTEXITCODE -eq 0 -and
            (Test-Path -LiteralPath $OutFile) -and
            (Get-Item -LiteralPath $OutFile).Length -gt 0) {
            return
        }
    }

    throw "Download failed after retries: $Uri`n$lastError"
}

function Get-ExpectedHash {
    param([string]$ManifestPath, [string]$FileName)

    foreach ($line in Get-Content -LiteralPath $ManifestPath) {
        if ($line -match "^\s*([a-fA-F0-9]{64})\s+\*?(.+?)\s*$") {
            if ([IO.Path]::GetFileName($Matches[2]) -eq $FileName) {
                return $Matches[1].ToLowerInvariant()
            }
        }
    }
    throw "No SHA-256 entry for $FileName in checksum manifest."
}

$InstallDir = [IO.Path]::GetFullPath($InstallDir)
$dispatcher = Join-Path $InstallDir "codewhale.exe"
$runtime = Join-Path $InstallDir "codewhale-tui.exe"

if (-not $Force -and
    (Test-Path -LiteralPath $dispatcher) -and
    (Test-Path -LiteralPath $runtime)) {
    Write-Step "CodeWhale is already installed at $InstallDir"
    & $dispatcher --version
    exit $LASTEXITCODE
}

$tag = if ($Version.StartsWith("v")) { $Version } else { "v$Version" }
$archiveName = "codewhale-windows-x64-portable.zip"
$manifestName = "codewhale-artifacts-sha256.txt"
$releaseUrl = "$($ReleaseBaseUrl.TrimEnd('/'))/$tag"
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) (
    "deepseek-tide-codewhale-" + [Guid]::NewGuid().ToString("N")
)
$archivePath = Join-Path $tempRoot $archiveName
$manifestPath = Join-Path $tempRoot $manifestName
$extractPath = Join-Path $tempRoot "extract"

New-Item -ItemType Directory -Path $tempRoot | Out-Null

try {
    Invoke-Download "$releaseUrl/$archiveName" $archivePath
    Invoke-Download "$releaseUrl/$manifestName" $manifestPath

    $expected = Get-ExpectedHash $manifestPath $archiveName
    $actual = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) {
        throw "SHA-256 mismatch for $archiveName. Expected $expected, got $actual."
    }
    Write-Step "SHA-256 verified: $actual"

    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractPath -Force
    $dispatcherSource = Get-ChildItem -Path $extractPath -Recurse -Filter "codewhale.exe" |
        Select-Object -First 1
    $runtimeSource = Get-ChildItem -Path $extractPath -Recurse -Filter "codewhale-tui.exe" |
        Select-Object -First 1
    if (-not $dispatcherSource -or -not $runtimeSource) {
        throw "Official archive does not contain both required binaries."
    }

    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Copy-Item -LiteralPath $dispatcherSource.FullName -Destination $dispatcher -Force
    Copy-Item -LiteralPath $runtimeSource.FullName -Destination $runtime -Force

    $license = Get-ChildItem -Path $extractPath -Recurse -Filter "LICENSE*" |
        Select-Object -First 1
    if ($license) {
        Copy-Item -LiteralPath $license.FullName -Destination (
            Join-Path $InstallDir $license.Name
        ) -Force
    }

    Write-Step "Installed CodeWhale $tag to $InstallDir"
    & $dispatcher --version
    if ($LASTEXITCODE -ne 0) {
        throw "Installed dispatcher failed its version check."
    }

    if ($Configure) {
        Write-Step "Starting interactive DeepSeek credential setup."
        & $dispatcher auth set --provider deepseek
        if ($LASTEXITCODE -ne 0) {
            throw "Credential setup failed."
        }
    }
}
finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
