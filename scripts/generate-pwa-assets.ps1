# ============================================================================
# TuBus Express - PWA asset generator
# ============================================================================
# Generates all PWA icons and iOS splash screens from a single source PNG
# using .NET System.Drawing (built into Windows PowerShell — no external
# dependencies required).
#
# Run from the frontend/ directory:
#     powershell -ExecutionPolicy Bypass -File scripts/generate-pwa-assets.ps1
#
# Inputs:
#   public/autobus.png       - Source logo (square, ideally 1024x1024+)
#
# Outputs:
#   public/icons/icon-{72,96,128,144,152,180,192,384,512}.png   - PWA icons
#   public/splash/splash-{WxH}.png                              - iOS splashes
# ============================================================================

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

$root         = Split-Path -Parent $PSScriptRoot
$sourcePath   = Join-Path $root 'public\autobus.png'
$iconsDir     = Join-Path $root 'public\icons'
$splashDir    = Join-Path $root 'public\splash'
$brandColor   = [System.Drawing.ColorTranslator]::FromHtml('#001D56')
$splashBgHex  = '#FFFFFF'
$splashBg     = [System.Drawing.ColorTranslator]::FromHtml($splashBgHex)

if (-not (Test-Path $sourcePath)) {
    Write-Error "Source image not found: $sourcePath"
    exit 1
}

New-Item -ItemType Directory -Force -Path $iconsDir  | Out-Null
New-Item -ItemType Directory -Force -Path $splashDir | Out-Null

# ----------------------------------------------------------------------------
# Helper: Resize source image to a square PNG of `size` pixels, with
# high-quality bicubic interpolation.
# ----------------------------------------------------------------------------
function New-SquareIcon {
    param(
        [int]$Size,
        [string]$OutputPath
    )
    $src = [System.Drawing.Image]::FromFile($sourcePath)
    try {
        $bmp = New-Object System.Drawing.Bitmap $Size, $Size
        $bmp.SetResolution(96, 96)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        try {
            $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
            $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $g.Clear([System.Drawing.Color]::Transparent)
            $g.DrawImage($src, 0, 0, $Size, $Size)
        } finally {
            $g.Dispose()
        }
        $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        Write-Host "  icon $Size x $Size -> $OutputPath"
    } finally {
        $src.Dispose()
    }
}

# ----------------------------------------------------------------------------
# Helper: Generate an iOS splash screen — solid background with the logo
# centered at 25% of the shorter dimension. Matches Apple HIG splash specs.
# ----------------------------------------------------------------------------
function New-Splash {
    param(
        [int]$Width,
        [int]$Height,
        [string]$OutputPath
    )
    $src = [System.Drawing.Image]::FromFile($sourcePath)
    try {
        $bmp = New-Object System.Drawing.Bitmap $Width, $Height
        $bmp.SetResolution(96, 96)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        try {
            $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
            $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

            # Solid brand-aware background (white keeps the logo readable on
            # both light and dark iOS status bars).
            $bgBrush = New-Object System.Drawing.SolidBrush $splashBg
            $g.FillRectangle($bgBrush, 0, 0, $Width, $Height)
            $bgBrush.Dispose()

            # Center the logo at 25% of the shorter side
            $logoSize = [int]([Math]::Min($Width, $Height) * 0.25)
            $x = [int](($Width  - $logoSize) / 2)
            $y = [int](($Height - $logoSize) / 2)
            $g.DrawImage($src, $x, $y, $logoSize, $logoSize)
        } finally {
            $g.Dispose()
        }
        $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        Write-Host "  splash $Width x $Height -> $OutputPath"
    } finally {
        $src.Dispose()
    }
}

# ----------------------------------------------------------------------------
# Generate icons
# ----------------------------------------------------------------------------
Write-Host ''
Write-Host 'Generating PWA icons...'
$iconSizes = @(72, 96, 128, 144, 152, 180, 192, 384, 512)
foreach ($size in $iconSizes) {
    New-SquareIcon -Size $size -OutputPath (Join-Path $iconsDir "icon-$size.png")
}

# ----------------------------------------------------------------------------
# Generate iOS splash screens (portrait orientation, common iPhone sizes)
# ----------------------------------------------------------------------------
Write-Host ''
Write-Host 'Generating iOS splash screens...'
$splashSizes = @(
    @{ W =  640; H = 1136 },  # iPhone SE 1st gen / 5 / 5s
    @{ W =  750; H = 1334 },  # iPhone SE 2nd-3rd gen / 6 / 7 / 8
    @{ W =  828; H = 1792 },  # iPhone XR / 11
    @{ W = 1125; H = 2436 },  # iPhone X / XS / 11 Pro / 12 mini
    @{ W = 1170; H = 2532 },  # iPhone 12 / 13 / 14
    @{ W = 1242; H = 2208 },  # iPhone 6 Plus / 7 Plus / 8 Plus
    @{ W = 1242; H = 2688 },  # iPhone XS Max / 11 Pro Max
    @{ W = 1284; H = 2778 }   # iPhone 12 / 13 / 14 Pro Max
)
foreach ($s in $splashSizes) {
    $w = $s.W; $h = $s.H
    New-Splash -Width $w -Height $h -OutputPath (Join-Path $splashDir "splash-${w}x${h}.png")
}

Write-Host ''
Write-Host 'PWA assets generated successfully.'
