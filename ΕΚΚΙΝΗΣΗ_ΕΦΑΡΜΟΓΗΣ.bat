@echo off
chcp 65001 >nul
title Εφαρμογή Δήμου Αρχανών-Αστερούσιων

echo ========================================
echo    ΕΦΑΡΜΟΓΗ ΔΙΑΧΕΙΡΙΣΗΣ ΕΡΓΩΝ
echo    Δήμος Αρχανών-Αστερούσιων
echo ========================================
echo.

echo [1/3] ΕΛΕΓΧΟΣ NODE.JS...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js δεν είναι εγκατεστημένο!
    echo 📥 Εγκατάσταση Node.js...
    start /wait node-v22.19.0-x64.msi
    echo ✅ Node.js εγκαταστάθηκε!
    echo 🔄 Επανεκκίνηση εφαρμογής...
    goto :start
)

echo ✅ Node.js βρέθηκε!

:start
echo.
echo [2/3] ΕΛΕΓΧΟΣ ΕΞΑΡΤΗΣΕΩΝ...
if not exist "node_modules" (
    echo ⏳ Εγκατάσταση εξαρτήσεων...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Σφάλμα κατά την εγκατάσταση!
        pause
        exit /b 1
    )
    echo ✅ Εξαρτήσεις εγκαταστάθηκαν!
) else (
    echo ✅ Εξαρτήσεις υπάρχουν!
)

echo.
echo [3/3] ΕΚΚΙΝΗΣΗ ΕΦΑΡΜΟΓΗΣ...
echo 🚀 Ανοίγει η εφαρμογή...
REM Ρητό path αποθήκευσης δεδομένων
set "DATA_DIR=Z:\EFARMOGI\dedomena_ergon"
npm run electron

echo.
echo ========================================
echo    ΕΦΑΡΜΟΓΗ ΚΛΕΙΣΤΗΚΕ
echo ========================================
pause
