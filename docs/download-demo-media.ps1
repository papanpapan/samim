# Demo media kit — Unsplash CDN + Mixkit (no API key)
$ErrorActionPreference = 'Continue'
$base = 'C:\Project\saba\samim\docs\nacecary_photos_and_flowers_for_testing'

function Get-File([string]$Url, [string]$OutPath) {
  if ((Test-Path $OutPath) -and ((Get-Item $OutPath).Length -gt 5000)) {
    Write-Host "skip $OutPath"
    return $true
  }
  New-Item -ItemType Directory -Force -Path (Split-Path $OutPath) | Out-Null
  Write-Host "GET $(Split-Path $OutPath -Leaf)"
  curl.exe -L --fail --silent --show-error --connect-timeout 25 --max-time 90 `
    -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SN-ERMS-DemoKit" `
    -H "Accept: image/avif,image/webp,image/*,*/*" `
    -o $OutPath $Url
  if ((Test-Path $OutPath) -and ((Get-Item $OutPath).Length -gt 5000)) {
    Write-Host "  ok $([math]::Round((Get-Item $OutPath).Length/1KB)) KB"
    return $true
  }
  Write-Host "  FAIL"
  Remove-Item $OutPath -Force -ErrorAction SilentlyContinue
  return $false
}

# Curated Unsplash photo IDs (free license) — plant / fruit / flower / nursery scenes
$photos = @(
  @{ f='01_fruits\guava_bowl.jpg'; u='https://images.unsplash.com/photo-1536511130271-1c2a1e0d2b5b?auto=format&fit=crop&w=1280&q=80' },
  @{ f='01_fruits\mango_fresh.jpg'; u='https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=1280&q=80' },
  @{ f='01_fruits\banana_bunch.jpg'; u='https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=1280&q=80' },
  @{ f='01_fruits\citrus_oranges.jpg'; u='https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=1280&q=80' },
  @{ f='01_fruits\apple_red.jpg'; u='https://images.unsplash.com/photo-1560806887-1e4cd0b21086?auto=format&fit=crop&w=1280&q=80' },
  @{ f='01_fruits\pomegranate.jpg'; u='https://images.unsplash.com/photo-1603046891743-784d393c8b2f?auto=format&fit=crop&w=1280&q=80' },
  @{ f='01_fruits\papaya_cut.jpg'; u='https://images.unsplash.com/photo-1617112848923-cc67ddb8ceb8?auto=format&fit=crop&w=1280&q=80' },
  @{ f='01_fruits\mixed_tropical.jpg'; u='https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=1280&q=80' },

  @{ f='02_flowers\rose_red.jpg'; u='https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1280&q=80' },
  @{ f='02_flowers\sunflower.jpg'; u='https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=1280&q=80' },
  @{ f='02_flowers\orchid.jpg'; u='https://images.unsplash.com/photo-1561181286-d3fee7f4538d?auto=format&fit=crop&w=1280&q=80' },
  @{ f='02_flowers\tulips.jpg'; u='https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1280&q=80' },
  @{ f='02_flowers\marigold_field.jpg'; u='https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=1280&q=80' },
  @{ f='02_flowers\wildflowers.jpg'; u='https://images.unsplash.com/photo-1490750967868-88aa6486c31d?auto=format&fit=crop&w=1280&q=80' },
  @{ f='02_flowers\lotus.jpg'; u='https://images.unsplash.com/photo-1516195424320-a9e0d9a3a5c7?auto=format&fit=crop&w=1280&q=80' },
  @{ f='02_flowers\pink_bloom.jpg'; u='https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?auto=format&fit=crop&w=1280&q=80' },

  @{ f='03_indoor_plants\monstera.jpg'; u='https://images.unsplash.com/photo-1614594975527-c5d0c3f9b0f4?auto=format&fit=crop&w=1280&q=80' },
  @{ f='03_indoor_plants\succulent.jpg'; u='https://images.unsplash.com/photo-1459411552338-b9bc78504825?auto=format&fit=crop&w=1280&q=80' },
  @{ f='03_indoor_plants\snake_plant.jpg'; u='https://images.unsplash.com/photo-1593482892540-73c9199d8948?auto=format&fit=crop&w=1280&q=80' },
  @{ f='03_indoor_plants\pothos.jpg'; u='https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=1280&q=80' },
  @{ f='03_indoor_plants\peace_lily.jpg'; u='https://images.unsplash.com/photo-1593691509543-c55fb32d8de5?auto=format&fit=crop&w=1280&q=80' },
  @{ f='03_indoor_plants\indoor_shelf.jpg'; u='https://images.unsplash.com/photo-1485955900006-10f4d324ad86?auto=format&fit=crop&w=1280&q=80' },

  @{ f='04_outdoor_plants\garden_beds.jpg'; u='https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1280&q=80' },
  @{ f='04_outdoor_plants\nursery_rows.jpg'; u='https://images.unsplash.com/photo-1466692476866-aef1dfb1e735?auto=format&fit=crop&w=1280&q=80' },
  @{ f='04_outdoor_plants\palm.jpg'; u='https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=1280&q=80' },
  @{ f='04_outdoor_plants\saplings.jpg'; u='https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1280&q=80' },
  @{ f='04_outdoor_plants\hedge.jpg'; u='https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=1280&q=80' },
  @{ f='04_outdoor_plants\bamboo.jpg'; u='https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?auto=format&fit=crop&w=1280&q=80' },

  @{ f='05_mother_plants\orchard_trees.jpg'; u='https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1280&q=80' },
  @{ f='05_mother_plants\fruit_tree.jpg'; u='https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1280&q=80' },
  @{ f='05_mother_plants\graft_close.jpg'; u='https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1280&q=80' },
  @{ f='05_mother_plants\mother_canopy.jpg'; u='https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1280&q=80' },

  @{ f='06_propagation\seedlings.jpg'; u='https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1280&q=80' },
  @{ f='06_propagation\greenhouse.jpg'; u='https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1280&q=80' },
  @{ f='06_propagation\nursery_trays.jpg'; u='https://images.unsplash.com/photo-1466692476866-aef1dfb1e735?auto=format&fit=crop&w=1280&q=80' },
  @{ f='06_propagation\young_plants.jpg'; u='https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1280&q=80' },

  @{ f='07_inventory_stock\potted_display.jpg'; u='https://images.unsplash.com/photo-1485955900006-10f4d324ad86?auto=format&fit=crop&w=1280&q=80' },
  @{ f='07_inventory_stock\shop_shelf.jpg'; u='https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1280&q=80' },
  @{ f='07_inventory_stock\tagged_plant.jpg'; u='https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1280&q=80' },

  @{ f='08_pos_marketing\bouquet.jpg'; u='https://images.unsplash.com/photo-1490750967868-88aa6486c31d?auto=format&fit=crop&w=1280&q=80' },
  @{ f='08_pos_marketing\plant_shop.jpg'; u='https://images.unsplash.com/photo-1485955900006-10f4d324ad86?auto=format&fit=crop&w=1280&q=80' },
  @{ f='08_pos_marketing\garden_center.jpg'; u='https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1280&q=80' },

  @{ f='09_alerts_danger\farm_fence.jpg'; u='https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1280&q=80' },
  @{ f='09_alerts_danger\security_cam.jpg'; u='https://images.unsplash.com/photo-1557597774-9c82b382f74b?auto=format&fit=crop&w=1280&q=80' },
  @{ f='09_alerts_danger\night_path.jpg'; u='https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1280&q=80' },

  @{ f='10_plant_id_leaves\green_leaf.jpg'; u='https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1280&q=80' },
  @{ f='10_plant_id_leaves\leaf_veins.jpg'; u='https://images.unsplash.com/photo-1512428813834-c702c7702b78?auto=format&fit=crop&w=1280&q=80' },
  @{ f='10_plant_id_leaves\tropical_leaf.jpg'; u='https://images.unsplash.com/photo-1614594975527-c5d0c3f9b0f4?auto=format&fit=crop&w=1280&q=80' },
  @{ f='10_plant_id_leaves\close_leaf.jpg'; u='https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1280&q=80' },

  @{ f='11_vermicompost\rich_soil.jpg'; u='https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1280&q=80' },
  @{ f='11_vermicompost\compost_hands.jpg'; u='https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1280&q=80' },
  @{ f='11_vermicompost\garden_soil.jpg'; u='https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1280&q=80' },

  @{ f='12_care_field\watering.jpg'; u='https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1280&q=80' },
  @{ f='12_care_field\tools.jpg'; u='https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1280&q=80' },
  @{ f='12_care_field\pruning.jpg'; u='https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1280&q=80' },

  @{ f='13_live_camera\orchard_path.jpg'; u='https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1280&q=80' },
  @{ f='13_live_camera\greenhouse_aisle.jpg'; u='https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1280&q=80' },
  @{ f='13_live_camera\farm_gate.jpg'; u='https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1280&q=80' }
)

# Wikimedia Commons backups (if Unsplash blocks)
$wiki = @(
  @{ f='01_fruits\wiki_guava.jpg'; u='https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Guava_fruit.jpg/1280px-Guava_fruit.jpg' },
  @{ f='01_fruits\wiki_mango.jpg'; u='https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Mangifera_indica_-_Julio_de_2006.jpg/1280px-Mangifera_indica_-_Julio_de_2006.jpg' },
  @{ f='02_flowers\wiki_hibiscus.jpg'; u='https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Hibiscus_rosa-sinensis_flower_2.JPG/1280px-Hibiscus_rosa-sinensis_flower_2.JPG' },
  @{ f='02_flowers\wiki_marigold.jpg'; u='https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Tagetes_erecta%2C_African_marigold.jpg/1280px-Tagetes_erecta%2C_African_marigold.jpg' },
  @{ f='03_indoor_plants\wiki_snake.jpg'; u='https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Sansevieria_trifasciata.jpg/1024px-Sansevieria_trifasciata.jpg' },
  @{ f='04_outdoor_plants\wiki_garden.jpg'; u='https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Flower_garden.jpg/1280px-Flower_garden.jpg' },
  @{ f='10_plant_id_leaves\wiki_leaf.jpg'; u='https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Leaf_1_web.jpg/1280px-Leaf_1_web.jpg' }
)

$ok = 0
foreach ($p in $photos) {
  if (Get-File $p.u (Join-Path $base $p.f)) { $ok++ }
}
foreach ($p in $wiki) {
  if (Get-File $p.u (Join-Path $base $p.f)) { $ok++ }
}

$videos = @(
  @{ f='14_videos\fruits_oranges_tree.mp4'; u='https://assets.mixkit.co/videos/preview/mixkit-fresh-oranges-on-a-tree-4082-large.mp4' },
  @{ f='14_videos\fruits_yellow_tree.mp4'; u='https://assets.mixkit.co/videos/preview/mixkit-tree-with-yellow-fruits-4049-large.mp4' },
  @{ f='14_videos\flowers_garden.mp4'; u='https://assets.mixkit.co/videos/preview/mixkit-white-flowers-in-the-garden-2320-large.mp4' },
  @{ f='14_videos\flowers_pink_closeup.mp4'; u='https://assets.mixkit.co/videos/preview/mixkit-close-up-of-a-pink-flower-1080-large.mp4' },
  @{ f='14_videos\indoor_green_leaves.mp4'; u='https://assets.mixkit.co/videos/preview/mixkit-green-leaves-of-a-plant-23011-large.mp4' },
  @{ f='14_videos\propagation_growing.mp4'; u='https://assets.mixkit.co/videos/preview/mixkit-hands-holding-a-growing-plant-21920-large.mp4' },
  @{ f='14_videos\care_gardening.mp4'; u='https://assets.mixkit.co/videos/preview/mixkit-woman-gardening-in-her-garden-39820-large.mp4' },
  @{ f='14_videos\propagation_greenhouse.mp4'; u='https://assets.mixkit.co/videos/preview/mixkit-plants-in-a-greenhouse-4178-large.mp4' },
  @{ f='14_videos\outdoor_park_walk.mp4'; u='https://assets.mixkit.co/videos/preview/mixkit-walking-in-a-park-with-trees-4503-large.mp4' },
  @{ f='14_videos\alerts_security_cam.mp4'; u='https://assets.mixkit.co/videos/preview/mixkit-security-camera-looking-around-4223-large.mp4' }
)

foreach ($v in $videos) {
  if (Get-File $v.u (Join-Path $base $v.f)) { $ok++ }
}

$copies = @(
  @{ from='14_videos\fruits_oranges_tree.mp4'; to='05_mother_plants\mother_demo.mp4' },
  @{ from='14_videos\propagation_growing.mp4'; to='06_propagation\batch_demo.mp4' },
  @{ from='14_videos\indoor_green_leaves.mp4'; to='07_inventory_stock\stock_demo.mp4' },
  @{ from='14_videos\flowers_garden.mp4'; to='08_pos_marketing\promo_demo.mp4' },
  @{ from='14_videos\alerts_security_cam.mp4'; to='09_alerts_danger\intrusion_demo.mp4' },
  @{ from='14_videos\care_gardening.mp4'; to='12_care_field\care_demo.mp4' },
  @{ from='14_videos\propagation_greenhouse.mp4'; to='13_live_camera\live_demo.mp4' }
)
foreach ($c in $copies) {
  $src = Join-Path $base $c.from
  $dst = Join-Path $base $c.to
  if ((Test-Path $src) -and -not (Test-Path $dst)) {
    Copy-Item $src $dst -Force
    Write-Host "copy $($c.to)"
  }
}

@'
SN-ERMS demo media kit
======================
Use these folder-wise images/videos when demoing each feature upload.

01_fruits            Fruit plant / produce photos
02_flowers           Flower photos
03_indoor_plants     Indoor / houseplants
04_outdoor_plants    Outdoor nursery / garden
05_mother_plants     Mother Plants (+ mother_demo.mp4)
06_propagation       Propagation Hub (+ batch_demo.mp4)
07_inventory_stock   Inventory (+ stock_demo.mp4)
08_pos_marketing     POS marketing (+ promo_demo.mp4)
09_alerts_danger     Danger alerts (+ intrusion_demo.mp4)
10_plant_id_leaves   Identify plant (leaf photos)
11_vermicompost      Vermicompost
12_care_field        Care (+ care_demo.mp4)
13_live_camera       Live scenes (+ live_demo.mp4)
14_videos            All MP4 clips

Sources: Unsplash (photos), Wikimedia Commons, Mixkit (videos).
Local demo/testing only — use your nursery media in production.
'@ | Set-Content (Join-Path $base 'README.txt') -Encoding UTF8

Write-Host ''
Write-Host "=== DONE ok=$ok ==="
Get-ChildItem $base -Recurse -File | Group-Object DirectoryName | ForEach-Object {
  $name = Split-Path $_.Name -Leaf
  Write-Host "$name : $($_.Count) files"
}
$total = (Get-ChildItem $base -Recurse -File | Measure-Object Length -Sum).Sum
Write-Host "Total MB: $([math]::Round($total/1MB, 1))"
