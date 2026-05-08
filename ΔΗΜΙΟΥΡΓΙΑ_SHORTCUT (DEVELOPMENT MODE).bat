@echo off
chcp 65001 >nul
title Δημιουργία Shortcut

echo ========================================
echo    Δημιουργία Shortcut
echo    Δήμος Αρχανών-Αστερούσιων
echo ========================================
echo.

echo Δημιουργία shortcut στην επιφάνεια εργασίας...
echo.

for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "desktop=%%i"
set "appPath=%~dp0ΕΚΚΙΝΗΣΗ_ΕΦΑΡΜΟΓΗΣ.bat"
set "shortcutPath=%desktop%\Εφαρμογή Δήμου Αρχανών-Αστερούσιων.lnk"

echo App Path: %appPath%
echo Shortcut Path: %shortcutPath%
echo.

powershell -Command "& {$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%shortcutPath%'); $Shortcut.TargetPath = '%appPath%'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.Description = 'Εφαρμογή Διαχείρισης Έργων - Δήμος Αρχανών-Αστερούσιων'; $Shortcut.Save()}"

if exist "%shortcutPath%" (
    echo [OK] Shortcut δημιουργήθηκε επιτυχώς!
    echo Path: %shortcutPath%
) else (
    echo [ΠΡΟΒΛΗΜΑ] Δεν μπόρεσε να δημιουργήσει το shortcut!
)

echo.
echo Πατήστε Enter για να κλείσει...
pause >nul
