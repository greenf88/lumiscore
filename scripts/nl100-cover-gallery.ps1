param([int]$Page=1)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$taskRoot=Split-Path $PSScriptRoot -Parent
$proof=Get-Content -LiteralPath (Join-Path $taskRoot 'catalog/nl100-completion-20261031/cover-proof.json') -Raw | ConvertFrom-Json
$rows=@($proof | Where-Object { $_.localQAFile -and $_.status -eq 200 })
$chosen=@($rows | Select-Object -Skip (($Page-1)*12) -First 12)
if($chosen.Count -eq 0){ throw 'No images on this page' }
$bitmap=New-Object System.Drawing.Bitmap(1200,1320)
$canvas=[System.Drawing.Graphics]::FromImage($bitmap)
$canvas.Clear([System.Drawing.Color]::White)
$font=New-Object System.Drawing.Font('Arial',12)
$brush=[System.Drawing.Brushes]::Black
$sizes=@()
for($i=0;$i -lt $chosen.Count;$i++){
 $row=$chosen[$i]
 $pic=[System.Drawing.Image]::FromFile($row.localQAFile)
 $col=$i%4; $r=[math]::Floor($i/4); $x=$col*300; $y=$r*440
 $scale=[math]::Min(280/$pic.Width,390/$pic.Height)
 $w=[int]($pic.Width*$scale); $h=[int]($pic.Height*$scale)
 $canvas.DrawImage($pic,($x+[int]((300-$w)/2)),($y+5),$w,$h)
 $canvas.DrawString(($row.workId.ToString()+' | '+$row.isbn),$font,$brush,($x+5),($y+405))
 $sizes+=@{workId=$row.workId;isbn=$row.isbn;width=$pic.Width;height=$pic.Height}
 $pic.Dispose()
}
$outDir='C:/Users/rickg/Documents/Codex/2026-09-18/ga-x20/outputs/nl100-completion-20261031'
$target=Join-Path $outDir ('cover-gallery-'+$Page+'.png')
$bitmap.Save($target,[System.Drawing.Imaging.ImageFormat]::Png)
$canvas.Dispose();$bitmap.Dispose();$font.Dispose()
$sizes | ConvertTo-Json -Compress
Write-Output $target
