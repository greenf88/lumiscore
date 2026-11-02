$ErrorActionPreference = 'Stop'
$artifactRoot = Join-Path (Get-Location) 'outputs/nl-scale-20261102'
$previewOrigin = 'https://lumiscore-9ue18tr1w-rgkgroeneveld-9102.vercel.app'
$probes = @(
  @{ Name='new-detail'; Path='/nl/book/987100001'; Expected='Niemand zeggen'; Samples=2 },
  @{ Name='existing-control'; Path='/nl/book/8800309'; Expected='Het laatste rijk'; Samples=3 },
  @{ Name='search'; Path='/nl/search?q=Niemand%20zeggen&pageSize=16&sort=relevance'; Expected='Niemand zeggen'; Samples=3 }
)
$measurements = @()
foreach ($probe in $probes) {
  for ($sample=1; $sample -le $probe.Samples; $sample++) {
    $htmlPath = Join-Path $artifactRoot ($probe.Name+'-response-'+$sample+'.html')
    $format = '{"status":%{http_code},"ttfbSeconds":%{time_starttransfer},"totalSeconds":%{time_total},"bytes":%{size_download},"vercelCache":"%header{x-vercel-cache}","httpVersion":"%{http_version}"}\n'
    $raw = & vercel curl ($previewOrigin+$probe.Path) --scope rgkgroeneveld-9102 -- --silent --show-error --max-time 30 --output $htmlPath --write-out $format 2>&1
    if ($LASTEXITCODE -ne 0) { throw ('Read-only measurement failed: '+$probe.Name+'; no login, link or retry attempted.') }
    $jsonLine = @($raw | ForEach-Object { $_.ToString() } | Where-Object { $_.StartsWith('{"status":') })
    if ($jsonLine.Count -ne 1) { throw 'Unexpected measurement output; no retry.' }
    $metric = $jsonLine[0] | ConvertFrom-Json
    $body = Get-Content -LiteralPath $htmlPath -Raw
    if ($metric.status -ne 200 -or !$body.Contains($probe.Expected) -or $body.Contains('Authentication Required')) { throw 'Not the requested application response; stop.' }
    $item = [ordered]@{ route=$probe.Name; path=$probe.Path; sample=$sample; measuredAt=(Get-Date).ToUniversalTime().ToString('o'); status=$metric.status; ttfbSeconds=$metric.ttfbSeconds; fullHtmlSeconds=$metric.totalSeconds; bytes=$metric.bytes; vercelCache=$metric.vercelCache; httpVersion=$metric.httpVersion; htmlSha256=(Get-FileHash -LiteralPath $htmlPath -Algorithm SHA256).Hash.ToLowerInvariant() }
    $measurements += $item
    $item | ConvertTo-Json -Compress | Write-Output
    [ordered]@{ deployment='dpl_9ruvyD65bjhJtzNvP4UuWbrxyXvg'; testedCommit='96c3efc5ebea86e286c72786db87aecc9138f5f3'; applicationBase='9c74ecaa48f7a35830f713eed3528d46ba0466ad'; protection='Existing authorised Vercel CLI protected-deployment access; this does not prove public access.'; definition='curl time_starttransfer: network/DNS/TLS/server to first byte; fullHtmlSeconds: response transfer completion. Neither is browser paint, visible-content or cover-load timing. Samples are first-observed/repeated requests, not proven cold functions. Existing control is a different Work, not a before/after causal comparison.'; measurements=$measurements } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $artifactRoot 'server-measurements.json') -Encoding utf8
  }
}
