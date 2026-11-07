#!/usr/bin/env bash
# macOS / Linux 실행 스크립트
echo "======================================================================="
echo "       [문서24 공문 일괄 발송 로컬 자동화 프로그램 (macOS / Linux)]"
echo "======================================================================="

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

if command -v python3 >/dev/null 2>&1; then
    PY_CMD=python3
elif command -v python >/dev/null 2>&1; then
    PY_CMD=python
else
    echo "[오류] python이 설치되어 있지 않습니다."
    exit 1
fi

echo "[정상] Python 실행 환경: $PY_CMD"
echo "[알림] 로컬 자동화 서버 시작 중 (포트 24000)..."
$PY_CMD "$DIR/doc24_agent.py"
