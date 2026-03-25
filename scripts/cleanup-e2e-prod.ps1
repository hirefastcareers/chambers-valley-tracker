param(
  [string]$BaseUrl = "https://chambers-valley-tracker.vercel.app",
  [string]$EnvFilePath = ".env.local"
)

$pwLine = Get-Content $EnvFilePath | Where-Object { $_ -match '^APP_PASSWORD=' } | Select-Object -First 1
if (-not $pwLine) {
  throw "APP_PASSWORD not found in $EnvFilePath"
}

$pw = ($pwLine -split "=", 2)[1]
if (-not $pw) {
  throw "APP_PASSWORD was empty in $EnvFilePath"
}

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

# Login (stores auth cookie in $session)
$loginBody = @{ password = $pw } | ConvertTo-Json
Invoke-WebRequest -Method POST `
  -Uri ($BaseUrl + "/api/auth/login") `
  -ContentType "application/json" `
  -Body $loginBody `
  -WebSession $session `
  -UseBasicParsing | Out-Null

# Fetch all customers, then delete the E2E-created ones.
$customersRes = Invoke-WebRequest -Method GET -Uri ($BaseUrl + "/api/customers") -WebSession $session -UseBasicParsing
$payload = $customersRes.Content | ConvertFrom-Json
$customers = @($payload.customers)

$e2eCustomers = $customers | Where-Object { $_.name -like "E2E Customer*" }
Write-Host ("Found E2E customers: {0}" -f $e2eCustomers.Count)

$deletedIds = @()
foreach ($c in $e2eCustomers) {
  $id = $c.id
  $name = $c.name
  Write-Host ("Deleting customer {0} {1}..." -f $id, $name)

  Invoke-WebRequest -Method DELETE -Uri ($BaseUrl + "/api/customers/" + $id) -WebSession $session -UseBasicParsing | Out-Null
  $deletedIds += $id
}

# Clear today's dashboard notes so no test note text remains.
$notesBody = @{ noteText = "" } | ConvertTo-Json
Invoke-WebRequest -Method PUT `
  -Uri ($BaseUrl + "/api/dashboard-notes") `
  -ContentType "application/json" `
  -Body $notesBody `
  -WebSession $session `
  -UseBasicParsing | Out-Null

Write-Host ("Cleared dashboard notes for today.")
Write-Host ("Total deleted customers: {0}" -f $deletedIds.Count)

