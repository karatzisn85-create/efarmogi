@echo off
chcp 65001 >nul
echo ========================================
echo ΚΑΘΑΡΙΣΜΟΣ ΜΗ ΧΡΗΣΙΜΟΠΟΙΟΥΜΕΝΩΝ ΑΡΧΕΙΩΝ
echo ========================================
echo.

REM Διαγραφή BACKUP components
echo [1/5] Διαγραφή BACKUP components...
if exist "src\components\Dashboard_BACKUP_20250102_143000.js" (
    del /q "src\components\Dashboard_BACKUP_20250102_143000.js"
    echo   ✓ Διαγράφηκε: Dashboard_BACKUP_20250102_143000.js
) else (
    echo   - Δεν βρέθηκε: Dashboard_BACKUP_20250102_143000.js
)

if exist "src\components\Dashboard_BACKUP_20250930_113704.js" (
    del /q "src\components\Dashboard_BACKUP_20250930_113704.js"
    echo   ✓ Διαγράφηκε: Dashboard_BACKUP_20250930_113704.js
) else (
    echo   - Δεν βρέθηκε: Dashboard_BACKUP_20250930_113704.js
)

if exist "src\components\ProjectCard_BACKUP_20250930_113717.js" (
    del /q "src\components\ProjectCard_BACKUP_20250930_113717.js"
    echo   ✓ Διαγράφηκε: ProjectCard_BACKUP_20250930_113717.js
) else (
    echo   - Δεν βρέθηκε: ProjectCard_BACKUP_20250930_113717.js
)
echo.

REM Διαγραφή debug logs
echo [2/5] Διαγραφή debug log files...
if exist "build\debug_log.txt" (
    del /q "build\debug_log.txt"
    echo   ✓ Διαγράφηκε: build\debug_log.txt
) else (
    echo   - Δεν βρέθηκε: build\debug_log.txt
)

if exist "public\debug_log.txt" (
    del /q "public\debug_log.txt"
    echo   ✓ Διαγράφηκε: public\debug_log.txt
) else (
    echo   - Δεν βρέθηκε: public\debug_log.txt
)
echo.

REM Διαγραφή άδειου φακέλου scripts
echo [3/5] Έλεγχος φακέλου scripts...
if exist "scripts\" (
    dir /b "scripts\" 2>nul | findstr /v "^$" >nul
    if errorlevel 1 (
        rmdir "scripts\" 2>nul
        echo   ✓ Διαγράφηκε άδειος φάκελος: scripts\
    ) else (
        echo   - Ο φάκελος scripts\ δεν είναι άδειος, παραλείπεται
    )
) else (
    echo   - Δεν βρέθηκε: scripts\
)
echo.

REM Ενημέρωση για επιλογικές διαγραφές
echo [4/5] Επιλογικές διαγραφές (ΔΕΝ εκτελούνται αυτόματα):
echo   ⚠️  backup\ - Παλιά backup αρχεία
echo   ⚠️  BACKUP_dedomena_ergon_2025-10-29_11-39-51\ - Παλιό backup dedomena_ergon
echo   ⚠️  build\ - Build artifacts (μπορεί να αναδημιουργηθεί)
echo   ⚠️  dist\ - Distribution files (μπορεί να αναδημιουργηθεί)
echo.

REM Σύνοψη
echo [5/5] Ολοκλήρωση καθαρισμού...
echo.
echo ========================================
echo ✅ ΚΑΘΑΡΙΣΜΟΣ ΟΛΟΚΛΗΡΩΘΗΚΕ
echo ========================================
echo.
echo Για πλήρη καθαρισμό (συμπεριλαμβανομένων των επιλογικών):
echo   1. Ελέγξτε το αρχείο: ΑΡΧΕΙΑ_ΓΙΑ_ΔΙΑΓΡΑΦΗ.md
echo   2. Διαγράψτε χειροκίνητα τα επιλογικά αρχεία αν θέλετε
echo.
pause
