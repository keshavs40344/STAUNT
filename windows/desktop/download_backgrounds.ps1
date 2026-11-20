# PowerShell script to download free Unsplash images for STAUNT backgrounds
# Saves images to windows/desktop/assets/backgrounds and prints dimensions & file size
$assetDir = "C:/Users/HP/Desktop/STAUNT/windows/desktop/assets/backgrounds"
if (-not (Test-Path $assetDir)) {
    New-Item -ItemType Directory -Path $assetDir | Out-Null
}

$images = @(
    @{Name='sky_birds';       Url='https://source.unsplash.com/1920x1080/?birds,sky' },
    @{Name='mountain_mist';   Url='https://source.unsplash.com/1920x1080/?mountains,clouds,mist' },
    @{Name='aurora';          Url='https://source.unsplash.com/1920x1080/?aurora,borealis,mountains' },
    @{Name='underwater';      Url='https://source.unsplash.com/1920x1080/?underwater,light' },
    @{Name='cosmos';          Url='https://source.unsplash.com/1920x1080/?nebula,space,stars' },
    @{Name='abstract';        Url='https://source.unsplash.com/1920x1080/?abstract,ambient,texture' }
)

foreach ($img in $images) {
    $targetPath = Join-Path $assetDir "$($img.Name).jpg"
    Write-Host "Downloading $($img.Name) from $($img.Url) ..."
    # Download with custom User-Agent to avoid 503 errors
    $headers = @{'User-Agent'='Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    $maxAttempts = 3
    $attempt = 0
    $downloaded = $false
    while (-not $downloaded -and $attempt -lt $maxAttempts) {
        try {
            Invoke-WebRequest -Uri $img.Url -OutFile $targetPath -Headers $headers -ErrorAction Stop
            $downloaded = $true
        } catch {
            $attempt++
            Write-Host "Attempt $attempt failed for $($img.Name). Retrying..."
            Start-Sleep -Seconds 2
        }
    }
    # Load image to get dimensions
    try {
        Add-Type -AssemblyName System.Drawing
        $image = [System.Drawing.Image]::FromFile($targetPath)
        $width = $image.Width
        $height = $image.Height
        $image.Dispose()
    } catch {
        $width = $height = 'N/A'
    }
    $sizeKB = [Math]::Round((Get-Item $targetPath).Length / 1KB, 2)
    Write-Host "Saved $targetPath – ${width}x${height} – ${sizeKB}KB"
}
