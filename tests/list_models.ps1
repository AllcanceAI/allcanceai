$lines = Get-Content "c:\Users\Arabe\allcanceai\.env"
$key = ""
foreach ($line in $lines) {
    if ($line -match "VITE_XAI_API_KEY=(.+)") {
        $key = $Matches[1]
    }
}
$headers = @{ Authorization = "Bearer $key" }
$response = Invoke-RestMethod -Uri "https://api.x.ai/v1/models" -Headers $headers
$response.data | ForEach-Object { Write-Host $_.id }
