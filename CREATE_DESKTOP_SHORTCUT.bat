@echo off
chcp 65001 >nul
title Δημιουργία Shortcut - EFARMOGI
color 0A

echo ========================================
echo    Δημιουργία Shortcut - EFARMOGI
echo    Δήμος Αρχανών-Αστερούσιων
echo ========================================
echo.

set "exePath=%~dp0dist\EFARMOGI-App-1.0.0.exe"
set "iconPath=%~dp0public\icon.ico"
set "electronExePath=%~dp0dist\win-unpacked\electron.exe"
set "shortcutPath=%USERPROFILE%\Desktop\EFARMOGI.lnk"

REM Έλεγχος αν υπάρχει το .exe
if not exist "%exePath%" (
    echo [ΣΦΑΛΜΑ] Το εκτελέσιμο δεν βρέθηκε!
    echo Path: %exePath%
    echo.
    echo Βεβαιωθείτε ότι έχετε κάνει build την εφαρμογή.
    echo.
    pause
    exit /b 1
)

REM Έλεγχος αν υπάρχει το icon
if not exist "%iconPath%" (
    echo [ΠΡΟΣΟΧΗ] Το icon.ico δεν βρέθηκε!
    echo Path: %iconPath%
    echo.
    if exist "%electronExePath%" (
        echo Χρησιμοποιείται το icon από electron.exe (atom icon)
        set "iconPath=%electronExePath%"
    ) else (
        echo Θα χρησιμοποιηθεί το default icon.
        set "iconPath=%exePath%"
    )
    echo.
)

echo [INFO] Δημιουργία shortcut...
echo Executable: %exePath%
echo Icon: %iconPath%
echo Shortcut: %shortcutPath%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%shortcutPath%'); $Shortcut.TargetPath = '%exePath%'; $Shortcut.WorkingDirectory = '%~dp0dist'; $Shortcut.Description = 'EFARMOGI - ΕΦΑΡΜΟΓΗ ΔΙΑΧΕΙΡΙΣΗΣ ΕΡΓΩΝ'; $Shortcut.IconLocation = '%iconPath%'; $Shortcut.Save(); if (Test-Path '%shortcutPath%') { Write-Host '[OK] Shortcut δημιουργήθηκε επιτυχώς!' -ForegroundColor Green } else { Write-Host '[ΠΡΟΒΛΗΜΑ] Δεν μπόρεσε να δημιουργήσει το shortcut!' -ForegroundColor Red }"

if exist "%shortcutPath%" (
    echo.
    echo [OK] Shortcut δημιουργήθηκε στο Desktop!
    echo Path: %shortcutPath%
    echo.
    echo Μπορείτε να βρείτε το shortcut στο Desktop με όνομα "EFARMOGI"
) else (
    echo.
    echo [ΠΡΟΒΛΗΜΑ] Δεν μπόρεσε να δημιουργήσει το shortcut!
    echo Μπορείτε να δημιουργήσετε το shortcut χειροκίνητα:
    echo 1. Right-click στο EFARMOGI-App-1.0.0.exe
    echo 2. Create shortcut
    echo 3. Μετακίνησε το shortcut στο Desktop
)

echo.
pause

