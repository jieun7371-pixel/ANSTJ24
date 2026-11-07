@echo off
chcp 65001 >nul
title 문서24 로컬 자동화 바로가기 생성 및 설치
echo =======================================================================
echo          [문서24 로컬 자동화 환경 점검 및 설치]
echo =======================================================================
echo.
echo 1. Python 설치 확인...
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [경고] Python을 찾을 수 없습니다. python.org에서 설치해 주세요.
) else (
    echo [완료] Python 감지 성공!
)

echo.
echo 2. Google Chrome 설치 확인...
set CHROME_FOUND=0
if exist "%PROGRAMFILES%\Google\Chrome\Application\chrome.exe" set CHROME_FOUND=1
if exist "%PROGRAMFILES(X86)%\Google\Chrome\Application\chrome.exe" set CHROME_FOUND=1
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set CHROME_FOUND=1

if %CHROME_FOUND% EQU 1 (
    echo [완료] Google Chrome 브라우저 감지 성공!
) else (
    echo [주의] 기본 경로에서 Chrome을 찾지 못했습니다. 실행 시 레지스트리를 재탐색합니다.
)

echo.
echo 3. 바탕화면에 바로가기 생성...
set SCRIPT_DIR=%~dp0
set TARGET_BAT=%SCRIPT_DIR%run.bat
set SHORTCUT_PATH=%USERPROFILE%\Desktop\문서24_자동화실행.lnk

powershell "$s=(New-Object -COM WScript.Shell).CreateShortcut('%SHORTCUT_PATH%');$s.TargetPath='%TARGET_BAT%';$s.WorkingDirectory='%SCRIPT_DIR%';$s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo [완료] 바탕화면에 '문서24_자동화실행' 바로가기가 생성되었습니다!
) else (
    echo [안내] run.bat 파일을 더블 클릭하여 바로 실행하실 수 있습니다.
)

echo.
echo =======================================================================
echo 설치 준비가 완료되었습니다. 'run.bat' 또는 바탕화면 바로가기를 실행하세요!
echo =======================================================================
pause
