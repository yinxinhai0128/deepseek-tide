[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CodeWhaleArgs
)

$ErrorActionPreference = "Stop"
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$binary = Join-Path $root "vendor\codewhale\codewhale.exe"

$proxy = if ($env:DEEPSEEK_TIDE_PROXY) {
    $env:DEEPSEEK_TIDE_PROXY
} elseif ($env:WHALETIDE_PROXY) {
    $env:WHALETIDE_PROXY
} else {
    $env:CODETIDE_PROXY
}

if (-not $proxy) {
    foreach ($candidatePort in 7897, 7890, 10809, 1080) {
        $client = [Net.Sockets.TcpClient]::new()
        try {
            $connection = $client.ConnectAsync("127.0.0.1", $candidatePort)
            if ($connection.Wait(200) -and $client.Connected) {
                $proxy = "http://127.0.0.1:$candidatePort"
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

if (-not (Test-Path -LiteralPath $binary)) {
    Write-Host "[deepseek-tide] CodeWhale is not installed; bootstrapping v0.8.53." `
        -ForegroundColor Yellow
    & (Join-Path $PSScriptRoot "install-codewhale.ps1")
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

if ($proxy) {
    $env:HTTPS_PROXY = $proxy
    $env:HTTP_PROXY = $proxy
}

& $binary @CodeWhaleArgs
exit $LASTEXITCODE
