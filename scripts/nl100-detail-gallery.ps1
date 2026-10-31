param([int]$Page=1)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$taskRoot=Split-Path $PSScriptRoot -Parent
$proofRoot=Join-Path $taskRoot 'catalog/nl100-hosted-20261031/detail-variants'
$rows=@(Get-ChildItem -LiteralPath $proofRoot -Filter '*.json' | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json -AsHashtable } | Where-Object localQAFile)
$sizes=@()
foreach($row in $rows){$pic=[System.Drawing.Image]::FromFile($row.localQAFile);try{$sizes+=@{workId=$row.workId;isbn=$row.isbn;width=$pic.Width;height=$pic.Height;bytes=$row.bytes}}finally{$pic.Dispose()}}
$chosen=@($rows | Select-Object -Skip (($Page-1)*12) -First 12)
if($chosen.Count -eq 0){throw 'No QA rows'}
$bitmap=New-Object System.Drawing.Bitmap(1200,1320)
$canvas=[System.Drawing.Graphics]::FromImage($bitmap)
$canvas.Clear([System.Drawing.Color]::White)
$font=New-Object System.Drawing.Font('Arial',12)
for($i=0;$i -lt $chosen.Count;$i++){
 $row=$chosen[$i];$pic=[System.Drawing.Image]::FromFile($row.localQAFile)
 $x=($i%4)*300;$y=[math]::Floor($i/4)*440
 $scale=[math]::Min(280/$pic.Width,390/$pic.Height);$w=[int]($pic.Width*$scale);$h=[int]($pic.Height*$scale)
 $canvas.DrawImage($pic,($x+[int]((300-$w)/2)),($y+5),$w,$h)
 $canvas.DrawString(($row.workId.ToString()+' | '+$row.isbn),$font,[System.Drawing.Brushes]::Black,($x+5),($y+405));$pic.Dispose()
}
$outDir='C:/Users/rickg/Documents/Codex/2026-09-18/ga-x20/outputs/nl100-hosted-20261031'
$target=Join-Path $outDir ('detail-variants-'+$Page+'.png')
$bitmap.Save($target,[System.Drawing.Imaging.ImageFormat]::Png)
$canvas.Dispose();$bitmap.Dispose();$font.Dispose()
$sizes | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskRoot 'catalog/nl100-hosted-20261031/detail-variant-dimensions.json') -Encoding utf8
Write-Output $target
