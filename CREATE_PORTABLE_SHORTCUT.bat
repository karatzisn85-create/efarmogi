@echo off
chcp 65001 >nul
title Δημιουργία Shortcut - Portable Mode

echo ========================================
echo    Δημιουργία Shortcut - Portable Mode
echo    Δήμος Αρχανών-Αστερούσιων
echo ========================================
echo.

echo Δημιουργία shortcut για το portable εκτελέσιμο...
echo.

for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "desktop=%%i"
set "portableExe=%~dp0dist\win-unpacked\ΕΦΑΡΜΟΓΗ ΔΙΑΧΕΙΡΙΣΗΣ ΕΡΓΩΝ.exe"
set "shortcutPath=%desktop%\ProjectAppPortable.lnk"

echo Portable Executable: %portableExe%
echo Shortcut Path: %shortcutPath%
echo.

REM Έλεγχος αν υπάρχει το portable εκτελέσιμο
if not exist "%portableExe%" (
    echo [ΣΦΑΛΜΑ] Το portable εκτελέσιμο δεν βρέθηκε!
    echo Path: %portableExe%
    echo.
    echo Βεβαιωθείτε ότι έχετε κάνει build την εφαρμογή με:
    echo    npm run electron-pack
    echo.
    echo Πατήστε Enter για να κλείσει...
    pause >nul
    exit /b 1
)

echo [INFO] Βρέθηκε το portable εκτελέσιμο!
echo.

powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%shortcutPath%'); $Shortcut.TargetPath = '%portableExe%'; $Shortcut.WorkingDirectory = '%~dp0dist\win-unpacked'; $Shortcut.Description = 'Project Management App - Portable Mode'; $Shortcut.Save()"

if exist "%shortcutPath%" (
    echo [OK] Shortcut δημιουργήθηκε επιτυχώς!
    echo Path: %shortcutPath%
    echo.
    echo Το shortcut θα ανοίγει την εφαρμογή σε PORTABLE MODE
    echo (δεν χρειάζεται Node.js ή development environment)
) else (
    echo [ΠΡΟΒΛΗΜΑ] Δεν μπόρεσε να δημιουργήσει το shortcut!
)

echo.
echo Πατήστε Enter για να κλείσει...
pause >nul
