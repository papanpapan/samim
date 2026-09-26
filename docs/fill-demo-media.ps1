$base = "C:\Project\saba\samim\docs\nacecary_photos_and_flowers_for_testing"
function DL([string]$url, [string]$rel) {
  $out = Join-Path $base $rel
  New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
  if ((Test-Path $out) -and ((Get-Item $out).Length -gt 5000)) {
    Write-Host "skip $rel"
    return $true
  }
  Write-Host "GET $rel"
  curl.exe -L --fail --silent --show-error --connect-timeout 25 --max-time 180 -A "Mozilla/5.0" -o $out $url
  if ((Test-Path $out) -and ((Get-Item $out).Length -gt 5000)) {
    $kb = [math]::Round((Get-Item $out).Length / 1KB)
    Write-Host " ok ${kb}KB"
    return $true
  }
  Write-Host " FAIL"
  Remove-Item $out -Force -ErrorAction SilentlyContinue
  return $false
}

DL "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" "14_videos\flower_mdn.mp4"
DL "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm" "14_videos\flower_mdn.webm"
DL "https://www.w3schools.com/html/mov_bbb.mp4" "14_videos\bbb_short.mp4"
DL "https://www.w3schools.com/html/movie.mp4" "14_videos\movie_w3.mp4"

DL "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=1280&q=80" "01_fruits\tropical_fruit.jpg"
DL "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=1280&q=80" "01_fruits\bananas_2.jpg"
DL "https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=1280&q=80" "01_fruits\oranges_2.jpg"
DL "https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=1280&q=80" "02_flowers\sunflower_2.jpg"
DL "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1280&q=80" "02_flowers\tulips_2.jpg"
DL "https://images.unsplash.com/photo-1593482892540-73c9199d8948?auto=format&fit=crop&w=1280&q=80" "03_indoor_plants\snake_plant.jpg"
DL "https://images.unsplash.com/photo-1593691509543-c55fb32d8de5?auto=format&fit=crop&w=1280&q=80" "03_indoor_plants\peace_lily_2.jpg"
DL "https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=1280&q=80" "04_outdoor_plants\hedge_2.jpg"
DL "https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?auto=format&fit=crop&w=1280&q=80" "04_outdoor_plants\bamboo_2.jpg"
DL "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1280&q=80" "07_inventory_stock\orchard_stock.jpg"
DL "https://images.unsplash.com/photo-1490750967868-88aa6486c31d?auto=format&fit=crop&w=1280&q=80" "08_pos_marketing\wildflowers_promo.jpg"
DL "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1280&q=80" "09_alerts_danger\farm_field.jpg"
DL "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1280&q=80" "09_alerts_danger\foggy_path.jpg"
DL "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1280&q=80" "11_vermicompost\forest_floor.jpg"
DL "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1280&q=80" "12_care_field\garden_work.jpg"

$vidDir = Join-Path $base "14_videos"
$vid = Get-ChildItem $vidDir -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Length -gt 20000 } |
  Sort-Object Length -Descending |
  Select-Object -First 1

if ($vid) {
  $targets = @(
    "01_fruits\fruit_demo",
    "02_flowers\flower_demo",
    "03_indoor_plants\indoor_demo",
    "04_outdoor_plants\outdoor_demo",
    "05_mother_plants\mother_demo",
    "06_propagation\batch_demo",
    "07_inventory_stock\stock_demo",
    "08_pos_marketing\promo_demo",
    "09_alerts_danger\intrusion_demo",
    "11_vermicompost\compost_demo",
    "12_care_field\care_demo",
    "13_live_camera\live_demo"
  )
  foreach ($t in $targets) {
    $dst = Join-Path $base ($t + $vid.Extension)
    if (-not (Test-Path $dst)) {
      Copy-Item $vid.FullName $dst
      Write-Host "copy $t$($vid.Extension)"
    }
  }
} else {
  Write-Host "No video files downloaded"
}

Write-Host "=== FINAL ==="
Get-ChildItem $base -Directory | ForEach-Object {
  $files = @(Get-ChildItem $_.FullName -File -ErrorAction SilentlyContinue)
  $sum = 0
  if ($files.Count -gt 0) { $sum = ($files | Measure-Object Length -Sum).Sum }
  $kb = [math]::Round($sum / 1KB)
  Write-Host ("{0}: {1} files ({2} KB)" -f $_.Name, $files.Count, $kb)
}
$all = @(Get-ChildItem $base -Recurse -File)
$mb = [math]::Round((($all | Measure-Object Length -Sum).Sum) / 1MB, 1)
Write-Host "Grand total: $($all.Count) files / $mb MB"
