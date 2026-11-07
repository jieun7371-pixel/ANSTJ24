@echo off
chcp 65001 >nul
title 문서24 공문 일괄 발송 로컬 자동화 에이전트
color 1F

echo =======================================================================
echo         [문서24 공문 일괄 발송 로컬 자동화 프로그램]
echo =======================================================================
echo.
echo  * 프로그램이 실행되면 웹 브라우저 관리 웹사이트와 실시간으로 통신합니다.
echo  * 웹사이트에서 [Chrome 실행] 버튼을 누르면 전용 Chrome이 실행됩니다.
echo  * 본 창을 닫지 마시고 최소화해 두세요.
echo.
echo -----------------------------------------------------------------------

:: 1. Python 설치 확인
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set PY_CMD=python
    goto RUN_AGENT
)

where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set PY_CMD=py
    goto RUN_AGENT
)

echo [오류] PC에 Python이 설치되어 있지 않습니다.
echo https://www.python.org 에서 Python을 다운로드하여 설치해 주세요.
echo (설치 시 "Add Python to PATH"에 반드시 체크해 주세요.)
echo.
pause
exit /b 1

:RUN_AGENT
echo [정상] Python 실행 환경 확인: %PY_CMD%
echo [알림] 로컬 자동화 서버 시작 중 (포트: 24000)...
echo.
%PY_CMD% "%~dp0doc24_agent.py"

pause
