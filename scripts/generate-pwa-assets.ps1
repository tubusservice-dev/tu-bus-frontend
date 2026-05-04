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
#   public/favicon.ico                                          - Multi-res favicon (16/32/48)
#   public/icons/icon-{72,96,128,144,152,180,192,384,512}.png   - PWA icons
#   public/splash/splash-{WxH}.png                              - iOS splashes
# ============================================================================

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference   = 'Stop'
$InformationPreference   = 'Continue'

$root         = Split-Path -Parent $PSScriptRoot
$sourcePath   = Join-Path $root 'public\autobus.png'
$iconsDir     = Join-Path $root 'public\icons'
$splashDir    = Join-Path $root 'public\splash'
# White splash background keeps the logo readable on both light/dark
# iOS status bars. Brand blue would clash with the dark status bar text.
$splashBg     = [System.Drawing.ColorTranslator]::FromHtml('#FFFFFF')

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
        Write-Information "  icon $Size x $Size -> $OutputPath"
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
        Write-Information "  splash $Width x $Height -> $OutputPath"
    } finally {
        $src.Dispose()
    }
}

# ----------------------------------------------------------------------------
# Helper: Build a multi-resolution favicon.ico from the source PNG.
# The ICO format embeds several PNG-encoded bitmaps so the OS / browser
# picks the optimal size for each surface (tab 16x16, taskbar 32x32,
# tile 48x48). Modern ICO files with PNG payloads are supported by all
# browsers since IE11 / Edge / Chrome / Firefox / Safari.
# ----------------------------------------------------------------------------
function New-MultiSizeFavicon {
    param(
        [string]$OutputPath,
        [int[]]$Sizes = @(16, 32, 48)
    )

    $src = [System.Drawing.Image]::FromFile($sourcePath)
    $pngBlobs = @()

    try {
        foreach ($size in $Sizes) {
            $bmp = New-Object System.Drawing.Bitmap $size, $size
            $bmp.SetResolution(96, 96)
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            try {
                $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
                $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
                $g.Clear([System.Drawing.Color]::Transparent)
                $g.DrawImage($src, 0, 0, $size, $size)
            } finally {
                $g.Dispose()
            }

            $ms = New-Object System.IO.MemoryStream
            $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
            $pngBlobs += @{ Size = $size; Bytes = $ms.ToArray() }
            $bmp.Dispose()
            $ms.Dispose()
        }
    } finally {
        $src.Dispose()
    }

    $stream = [System.IO.File]::Open($OutputPath, [System.IO.FileMode]::Create)
    $writer = New-Object System.IO.BinaryWriter $stream
    try {
        # ICONDIR header (6 bytes)
        $writer.Write([UInt16]0)                  # reserved
        $writer.Write([UInt16]1)                  # type = icon (not cursor)
        $writer.Write([UInt16]$pngBlobs.Count)    # number of images

        # First image data starts after the directory entries
        $offset = 6 + ($pngBlobs.Count * 16)

        # ICONDIRENTRY blocks (16 bytes each)
        foreach ($blob in $pngBlobs) {
            $dim = [Byte]([Math]::Min($blob.Size, 255))   # 0 means 256
            $writer.Write($dim)                            # width
            $writer.Write($dim)                            # height
            $writer.Write([Byte]0)                         # palette count (0 = no palette)
            $writer.Write([Byte]0)                         # reserved
            $writer.Write([UInt16]1)                       # color planes
            $writer.Write([UInt16]32)                      # bits per pixel
            $writer.Write([UInt32]$blob.Bytes.Length)      # data size
            $writer.Write([UInt32]$offset)                 # data offset
            $offset += $blob.Bytes.Length
        }

        # Image payloads (PNG-encoded)
        foreach ($blob in $pngBlobs) {
            $writer.Write($blob.Bytes)
        }
    } finally {
        $writer.Dispose()
        $stream.Dispose()
    }

    Write-Information "  favicon ($($Sizes -join '/')) -> $OutputPath"
}

# ----------------------------------------------------------------------------
# Generate favicon.ico
# ----------------------------------------------------------------------------
Write-Information ''
Write-Information 'Generating favicon.ico...'
New-MultiSizeFavicon -OutputPath (Join-Path $root 'public\favicon.ico')

# ----------------------------------------------------------------------------
# Generate icons
# ----------------------------------------------------------------------------
Write-Information ''
Write-Information 'Generating PWA icons...'
$iconSizes = @(72, 96, 128, 144, 152, 180, 192, 384, 512)
foreach ($size in $iconSizes) {
    New-SquareIcon -Size $size -OutputPath (Join-Path $iconsDir "icon-$size.png")
}

# ----------------------------------------------------------------------------
# Generate iOS splash screens (portrait orientation, common iPhone sizes)
# ----------------------------------------------------------------------------
Write-Information ''
Write-Information 'Generating iOS splash screens...'
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

Write-Information ''
Write-Information 'PWA assets generated successfully.'
