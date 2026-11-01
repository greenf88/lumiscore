param([string]$ProofFile='review-cover-proof.json',[string]$Prefix='contact')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$taskRoot=Split-Path -Parent $PSScriptRoot
$proofPath=Join-Path $taskRoot ('catalog/nl-followup-008-20261031/'+$ProofFile)
$rows=Get-Content -LiteralPath $proofPath -Raw | ConvertFrom-Json
$outputRoot='C:/Users/rickg/Documents/Codex/2026-09-18/ga-x20/outputs/nl-followup-008-20261031'
$font=[System.Drawing.Font]::new('Arial',11)
for($offset=0;$offset -lt $rows.Count;$offset+=12){
 $bitmap=[System.Drawing.Bitmap]::new(840,1560)
 $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
 $graphics.Clear([System.Drawing.Color]::White)
 for($j=0;$j -lt 12 -and $offset+$j -lt $rows.Count;$j++){
  $item=$rows[$offset+$j];if(-not $item.localQAFile){continue}
  $image=[System.Drawing.Image]::FromFile($item.localQAFile)
  $left=([int]($j%3))*280;$top=([int][Math]::Floor($j/3))*390
  $scale=[Math]::Min(250.0/$image.Width,330.0/$image.Height)
  $graphics.DrawImage($image,[int]($left+15),[int]($top+8),[int]($image.Width*$scale),[int]($image.Height*$scale))
  $graphics.DrawString(([string]$item.workId+' | '+$item.isbn),$font,[System.Drawing.Brushes]::Black,[float]($left+8),[float]($top+344))
  $graphics.DrawString(([string]$item.title),$font,[System.Drawing.Brushes]::Black,[System.Drawing.RectangleF]::new($left+8,$top+361,264,28))
  $item|Add-Member -NotePropertyName dimensions -NotePropertyValue @{width=$image.Width;height=$image.Height} -Force
  $image.Dispose()
 }
 $name=Join-Path $outputRoot ($Prefix+'-'+(1+[int]($offset/12))+'.png')
 $bitmap.Save($name,[System.Drawing.Imaging.ImageFormat]::Png);$graphics.Dispose();$bitmap.Dispose();Write-Output $name
}
$font.Dispose()
[System.IO.File]::WriteAllText($proofPath,($rows|ConvertTo-Json -Depth 15)+[Environment]::NewLine,[System.Text.UTF8Encoding]::new($false))
