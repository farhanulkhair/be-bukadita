# Test script untuk verifikasi superadmin setelah migration (PowerShell)
# Usage: .\scripts\test_superadmin.ps1

$BaseUrl = "http://localhost:4000/api/v1"
$Email = if ($env:SUPERADMIN_EMAIL) { $env:SUPERADMIN_EMAIL } else { "superadmin@bukadita.com" }
$Password = if ($env:SUPERADMIN_PASSWORD) { $env:SUPERADMIN_PASSWORD } else { "your_password_here" }

Write-Host "=== Testing Superadmin Login ===" -ForegroundColor Cyan
Write-Host ""

# 1. Login
Write-Host "1. POST /auth/login" -ForegroundColor Yellow
$LoginBody = @{
    email = $Email
    password = $Password
} | ConvertTo-Json

try {
    $LoginResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $LoginBody

    $LoginResponse | ConvertTo-Json -Depth 5 | Write-Host

    $Token = $LoginResponse.data.access_token
    $Role = $LoginResponse.data.user.profile.role

    if (-not $Token) {
        Write-Host "" 
        Write-Host "❌ Login failed! Check email/password in .env" -ForegroundColor Red
        exit 1
    }

    if ($Role -ne "superadmin") {
        Write-Host ""
        Write-Host "❌ Role is '$Role', expected 'superadmin'" -ForegroundColor Red
        Write-Host "Migration mungkin belum dijalankan atau superadmin belum di-recreate" -ForegroundColor Yellow
        exit 1
    }

    Write-Host ""
    Write-Host "✅ Login successful! Role: $Role" -ForegroundColor Green
    Write-Host ""

    # 2. Get users (admin endpoint)
    Write-Host "2. GET /admin/users" -ForegroundColor Yellow
    $Headers = @{
        Authorization = "Bearer $Token"
    }

    $UsersResponse = Invoke-RestMethod -Uri "$BaseUrl/admin/users?limit=5" `
        -Method Get `
        -Headers $Headers

    $UsersResponse | ConvertTo-Json -Depth 5 | Write-Host

    $CallerRole = $UsersResponse.visibility_rules.caller_role

    if ($CallerRole -eq "superadmin") {
        Write-Host ""
        Write-Host "✅ Admin endpoint accessible! Caller role: $CallerRole" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Unexpected visibility_rules. Caller role: $CallerRole" -ForegroundColor Red
        exit 1
    }

    Write-Host ""

    # 3. Get dashboard stats
    Write-Host "3. GET /admin/dashboard/stats" -ForegroundColor Yellow
    $StatsResponse = Invoke-RestMethod -Uri "$BaseUrl/admin/dashboard/stats" `
        -Method Get `
        -Headers $Headers

    $StatsResponse | ConvertTo-Json -Depth 5 | Write-Host

    Write-Host ""
    Write-Host "═══════════════════════════════════" -ForegroundColor Cyan
    Write-Host "✅ ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host "Superadmin berhasil dibuat dengan role yang benar" -ForegroundColor Green
    Write-Host "═══════════════════════════════════" -ForegroundColor Cyan

} catch {
    Write-Host ""
    Write-Host "❌ Request failed!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Yellow
    }
    
    exit 1
}
