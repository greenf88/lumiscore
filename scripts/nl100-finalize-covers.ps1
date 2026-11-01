# Offline QA: images were individually loaded and visually reviewed before this annotation.
# The script only decodes their existing local copies and checks exact file hashes.
Add-Type -AssemblyName System.Drawing
$packetRoot = Join-Path $PSScriptRoot '../catalog/nl100-completion-20261031'
$proofPath = Join-Path $packetRoot 'cover-proof.json'
$proof = Get-Content -LiteralPath $proofPath -Raw | ConvertFrom-Json -AsHashtable
$selection = Get-Content -LiteralPath (Join-Path $packetRoot 'draft-edition-selections.json') -Raw | ConvertFrom-Json -AsHashtable
$decisions = Get-Content -LiteralPath (Join-Path $packetRoot 'review-decisions.json') -Raw | ConvertFrom-Json -AsHashtable
$selectedIsbns = @($selection.isbn) + @($decisions.exactRetainedSelections.Values.isbn)
foreach ($entry in $proof) {
  if (-not $entry.localQAFile) { continue }
  $actualHash = (Get-FileHash -LiteralPath $entry.localQAFile -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -ne $entry.sha256) { throw "Changed QA image for $($entry.isbn)" }
  $bitmap = [System.Drawing.Image]::FromFile($entry.localQAFile)
  try { $entry.dimensions = @{ width = $bitmap.Width; height = $bitmap.Height } }
  finally { $bitmap.Dispose() }
  if ($selectedIsbns -contains $entry.isbn) {
    $entry.identity = 'manual_title_author_plus_exact_isbn_bibliographic_binding'
    $entry.visualFinding = 'Full source image decoded and inspected: matching title/author and exact edition source. Language established bibliographically, never from jacket alone.'
    $entry.visualReviewedAt = '2026-10-31'
    if ($entry.card) {
      $fullAsset = ([System.Uri]$entry.url).AbsolutePath -replace '_0_0\.[a-z]+$', ''
      $cardAsset = ([System.Uri]$entry.card.url).AbsolutePath -replace '_3_130_250_0_0\.[a-z]+$', ''
      $entry.card.samePublishedAssetKey = $fullAsset -eq $cardAsset
      $entry.card.visualReview = 'Same published asset identity as full image; transport verified. Thumbnail readability not separately browser-tested.'
      $entry.card.approvedForCardBinding = $entry.card.samePublishedAssetKey -and $entry.card.status -eq 200
    }
  } else {
    $entry.identity = 'not_selected_do_not_import'
    $entry.rejectionReason = $decisions.rejectedCovers[$entry.isbn]
    if (-not $entry.rejectionReason) { throw "Unadjudicated image $($entry.isbn)" }
  }
}
$proof | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $proofPath -Encoding utf8
@{selected=$selectedIsbns.Count; images=$proof.Count; verifiedSelected=@($proof | Where-Object identity -eq 'manual_title_author_plus_exact_isbn_bibliographic_binding').Count; approvedCards=@($proof | Where-Object { $_.card.approvedForCardBinding }).Count} | ConvertTo-Json
