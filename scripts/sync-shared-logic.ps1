$ErrorActionPreference = "Stop"
# Copies the pure shared logic from the client (source of truth) to the server.
# The server test "shared logic stays in sync" fails if these drift.
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "client\src\utils"
$dst = Join-Path $root "server\src\utils"
New-Item -ItemType Directory -Force -Path (Join-Path $dst "recipeMath") | Out-Null
foreach ($f in "quantity.ts", "units.ts", "ingredient.ts") {
  Copy-Item (Join-Path $src "recipeMath\$f") (Join-Path $dst "recipeMath\$f") -Force
}
Copy-Item (Join-Path $src "groceryMerge.ts") (Join-Path $dst "groceryMerge.ts") -Force
Write-Host "Synced shared logic to server/src/utils"
