@echo off
chcp 65001 >nul
title Build Both - Development & Portable

echo ========================================
echo    BUILD BOTH - Development & Portable
echo    Δήμος Αρχανών-Αστερούσιων
echo ========================================
echo.

echo [1/4] Καθαρισμός προηγούμενων builds...
if exist "build" rmdir /s /q "build"
if exist "dist" rmdir /s /q "dist"
echo.

echo [2/4] Δημιουργία React build...
call npm run build
if %errorlevel% neq 0 (
    echo [ΠΡΟΒΛΗΜΑ] React build απέτυχε!
    pause
    exit /b 1
)
echo [OK] React build ολοκληρώθηκε!
echo.

echo [3/4] Δημιουργία Electron build (Portable)...
call npm run dist
if %errorlevel% neq 0 (
    echo [ΠΡΟΒΛΗΜΑ] Electron build απέτυχε!
    pause
    exit /b 1
)
echo [OK] Electron build ολοκληρώθηκε!
echo.

echo [4/4] Έλεγχος αποτελεσμάτων...
if exist "build" (
    echo [OK] React build folder: build/
) else (
    echo [ΠΡΟΒΛΗΜΑ] React build folder δεν βρέθηκε!
)

if exist "dist\win-unpacked" (
    echo [OK] Portable executable: dist\win-unpacked\
) else (
    echo [ΠΡΟΒΛΗΜΑ] Portable executable δεν βρέθηκε!
)
echo.

echo ========================================
echo    BUILD ΟΛΟΚΛΗΡΩΘΗΚΕ ΕΠΙΤΥΧΩΣ!
echo ========================================
echo.
echo Development Mode: npm start
echo Portable Mode: dist\win-unpacked\ΕΦΑΡΜΟΓΗ ΔΙΑΧΕΙΡΙΣΗΣ ΕΡΓΩΝ.exe
echo.
echo Πατήστε Enter για να κλείσει...
pause >nul
