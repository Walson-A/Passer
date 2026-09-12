<#
.SYNOPSIS
    Test bench for the transfer HUD.

.DESCRIPTION
    The HUD only appears while the main window is hidden and retires after four
    seconds, which makes it awkward to look at. This hides the main window,
    fires real transfers through the REST API, reports what the HUD did, and
    always puts your window back.

    Guard rails, each from a mistake made while building the feature:
      * the HUD's size is read from tauri.conf.json, never hardcoded - a stale
        hardcoded size once made a working HUD look broken;
      * request bodies go through ConvertTo-Json, never hand-escaped quoting,
        which silently produced invalid JSON and a test that proved nothing;
      * the main window is restored in a finally block, so a crash mid-run
        cannot leave it hidden.

.PARAMETER Kind
    Which transfer to fire: text, image or file. Exercises /push, /push/image
    and /push/file respectively.

.PARAMETER Hold
    Keep the HUD on screen by re-firing every 3 seconds until you press a key.
    This is the mode for judging the look: the entry animation replays each
    time, and the card never gets a chance to retire.

.PARAMETER Count
    Fire this many transfers, one second apart. Use it to check that the newest
    one replaces what is showing and restarts the dismiss timer.

.PARAMETER KeepMainVisible
    Leave the main window visible. The HUD should then decline to appear at
    all - that is the feature, not a failure.

.EXAMPLE
    .\hud-bench.ps1
    .\hud-bench.ps1 -Hold
    .\hud-bench.ps1 -Kind file -Count 3
#>
[CmdletBinding()]
param(
    [ValidateSet('text', 'image', 'file')] [string] $Kind = 'text',
    [switch] $Hold,
    [int]    $Count = 1,
    [switch] $KeepMainVisible
)

$ErrorActionPreference = 'Stop'

# --- window plumbing ---------------------------------------------------------

Add-Type @"
using System; using System.Runtime.InteropServices;
public class HudBench {
  public delegate bool Proc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(Proc p, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  public struct RECT { public int L, T, R, B; }
}
"@ -ErrorAction SilentlyContinue

$SW_HIDE = 0; $SW_SHOW = 5

$passer = Get-Process passer -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $passer) { throw "Passer is not running. Start it with 'npm run tauri dev' first." }
$script:appPid = $passer.Id

function Get-PasserWindows {
    $script:found = @()
    $cb = [HudBench+Proc] {
        param($h, $l)
        $wp = 0; [void][HudBench]::GetWindowThreadProcessId($h, [ref]$wp)
        if ($wp -eq $script:appPid) {
            $r = New-Object HudBench+RECT; [void][HudBench]::GetWindowRect($h, [ref]$r)
            $w = $r.R - $r.L; $ht = $r.B - $r.T
            if ($w -gt 50 -and $ht -gt 20) {
                $script:found += [PSCustomObject]@{
                    Width = $w; Height = $ht
                    Visible = [HudBench]::IsWindowVisible($h)
                    X = $r.L; Y = $r.T; Handle = $h
                }
            }
        }
        return $true
    }
    [void][HudBench]::EnumWindows($cb, [IntPtr]::Zero)
    $script:found
}

# Sizes come from the config, so resizing a window never invalidates this script.
$confPath = Join-Path $PSScriptRoot '..\src-tauri\tauri.conf.json'
$conf = Get-Content $confPath -Raw | ConvertFrom-Json
$hudConf  = $conf.app.windows | Where-Object { $_.label -eq 'hud'  } | Select-Object -First 1
$mainConf = $conf.app.windows | Where-Object { $_.label -eq 'main' } | Select-Object -First 1
if (-not $hudConf) { throw "No window labelled 'hud' in tauri.conf.json." }

function Get-Hud  { Get-PasserWindows | Where-Object { $_.Width -eq $hudConf.width  -and $_.Height -eq $hudConf.height  } | Select-Object -First 1 }
function Get-Main { Get-PasserWindows | Where-Object { $_.Width -eq $mainConf.width -and $_.Height -eq $mainConf.height } | Select-Object -First 1 }

# --- transfers ---------------------------------------------------------------

$tokenPath = Join-Path $env:APPDATA 'Passer\pairing.token'
if (-not (Test-Path $tokenPath)) { throw "No pairing token at $tokenPath." }
$token = (Get-Content $tokenPath -Raw).Trim()
$headers = @{ 'X-Passer-Token' = $token }
$base = "http://localhost:8000"

# A 1x1 PNG. The HUD shows a type, a name and a size - the pixels are irrelevant.
$tinyPng = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')

function Send-Transfer([string] $kind, [int] $n) {
    switch ($kind) {
        'text' {
            Invoke-RestMethod -Method Post -Uri "$base/push" -Headers $headers `
                -ContentType 'application/json' `
                -Body (@{ text = "Bench transfer #$n" } | ConvertTo-Json)
        }
        'image' {
            $f = Join-Path $env:TEMP "hud-bench-$n.png"
            [IO.File]::WriteAllBytes($f, $tinyPng)
            try { Invoke-RestMethod -Method Post -Uri "$base/push/image" -Headers $headers -Form @{ file = Get-Item $f } }
            finally { Remove-Item $f -ErrorAction SilentlyContinue }
        }
        'file' {
            $f = Join-Path $env:TEMP "bench-note-$n.txt"
            "Bench transfer #$n, $(Get-Date -Format o)" | Set-Content $f
            try { Invoke-RestMethod -Method Post -Uri "$base/push/file" -Headers $headers -Form @{ file = Get-Item $f } }
            finally { Remove-Item $f -ErrorAction SilentlyContinue }
        }
    }
}

# --- run ---------------------------------------------------------------------

$main = Get-Main
$hudBefore = Get-Hud
Write-Host ""
Write-Host "Passer PID $($script:appPid)   HUD window $($hudConf.width)x$($hudConf.height) (from tauri.conf.json)" -ForegroundColor DarkGray

Add-Type -AssemblyName System.Windows.Forms
$wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea

# Read MARGIN from hud.rs rather than assume it. This was hardcoded to 16, and
# when Rust's MARGIN went to 0 the bench reported a false mismatch against a
# correctly positioned window - the exact failure the config-driven size above
# was meant to prevent, left open on the other half of the calculation.
$hudRs = Join-Path $PSScriptRoot '..\src-tauri\src\hud.rs'
$m = [regex]::Match((Get-Content $hudRs -Raw), 'const\s+MARGIN:\s*i32\s*=\s*(-?\d+)\s*;')
if (-not $m.Success) { throw "Could not read MARGIN from $hudRs - the bench would assert against a guess." }
$margin = [int]$m.Groups[1].Value

$expectX = $wa.X + $wa.Width  - $hudConf.width  - $margin
$expectY = $wa.Y + $wa.Height - $hudConf.height - $margin

try {
    if (-not $KeepMainVisible -and $main) {
        [void][HudBench]::ShowWindow($main.Handle, $SW_HIDE)
        Start-Sleep -Milliseconds 400
        Write-Host "main window hidden" -ForegroundColor DarkGray
    } elseif ($KeepMainVisible) {
        Write-Host "main window left visible - the HUD should decline to appear" -ForegroundColor Yellow
    }

    if ($Hold) {
        Write-Host "`nHolding the HUD on screen. It re-fires every 3s so the entry animation replays." -ForegroundColor Cyan
        Write-Host "Press any key to stop.`n" -ForegroundColor Cyan
        $n = 0
        while (-not [Console]::KeyAvailable) {
            $n++
            Send-Transfer $Kind $n | Out-Null
            Write-Host ("  fired #{0} ({1})" -f $n, $Kind)
            $waited = 0
            while ($waited -lt 3000 -and -not [Console]::KeyAvailable) { Start-Sleep -Milliseconds 100; $waited += 100 }
        }
        [void][Console]::ReadKey($true)
    }
    else {
        for ($n = 1; $n -le $Count; $n++) {
            Send-Transfer $Kind $n | Out-Null
            Write-Host ("fired #{0} ({1})" -f $n, $Kind)
            if ($n -lt $Count) { Start-Sleep -Seconds 1 }
        }

        Start-Sleep -Milliseconds 1800
        $shown = Get-Hud
        $appeared = $shown -and $shown.Visible

        Write-Host ""
        if ($KeepMainVisible) {
            if ($appeared) { Write-Host "FAIL  HUD appeared while the main window was visible" -ForegroundColor Red }
            else           { Write-Host "PASS  HUD stayed away while the main window was visible" -ForegroundColor Green }
        }
        else {
            if ($appeared) { Write-Host "PASS  HUD appeared at $($shown.X),$($shown.Y)" -ForegroundColor Green }
            else           { Write-Host "FAIL  HUD did not appear" -ForegroundColor Red }

            if ($appeared) {
                if ($shown.X -eq $expectX -and $shown.Y -eq $expectY) {
                    Write-Host "PASS  positioned bottom-right of the work area" -ForegroundColor Green
                } else {
                    Write-Host "WARN  expected $expectX,$expectY" -ForegroundColor Yellow
                }
            }

            Start-Sleep -Seconds 4
            $after = Get-Hud
            if ($after -and $after.Visible) {
                Write-Host "FAIL  still on screen after the dismiss timer - the frontend did not run" -ForegroundColor Red
                [void][HudBench]::ShowWindow($after.Handle, $SW_HIDE)
                Write-Host "      hidden defensively" -ForegroundColor DarkGray
            } else {
                Write-Host "PASS  retired itself" -ForegroundColor Green
            }
        }
    }
}
finally {
    # Always, even if something above threw: never leave the window hidden.
    if (-not $KeepMainVisible -and $main) {
        [void][HudBench]::ShowWindow($main.Handle, $SW_SHOW)
        Write-Host "`nmain window restored" -ForegroundColor DarkGray
    }
    if ($hudBefore) {
        $h = Get-Hud
        if ($h -and $h.Visible -and $Hold) { [void][HudBench]::ShowWindow($h.Handle, $SW_HIDE) }
    }
    Write-Host "note: your clipboard now holds the last bench transfer." -ForegroundColor DarkGray
}
