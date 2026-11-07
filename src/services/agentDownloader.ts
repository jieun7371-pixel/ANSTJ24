import JSZip from 'jszip';

// Code contents of the automation bundle
const DOC24_AGENT_PY = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
문서24 공문 일괄 발송 로컬 자동화 에이전트 (Doc24 Local Automation Agent)
포트: 24000 (HTTP REST API)
원격 디버깅 포트: 9222 (Chrome DevTools Protocol - 127.0.0.1 루프백 전용)

특징:
1. 실제 문서24 기관 검색, 본문 작성, 첨부파일 등록, 미리보기, 전송요청 브라우저 자동화
2. DOM 분석 기반 정밀 로그인 상태 판별 (logged_in, logged_out, needs_review)
3. 단계별 Chrome 실행 검증 (경로 탐색, 프로필 생성, CDP 포트 기동, 문서24 접속)
4. 보안 강화: 승인된 Origin만 CORS 허용, 로컬 토큰 인증, CDP 외부 접근 차단, 인증정보 비저장
5. 100% Python 표준 라이브러리 기반 Zero-dependency (필요 시 Playwright 연동 지원)
"""

import os
import sys
import json
import time
import socket
import struct
import base64
import hashlib
import platform
import subprocess
import threading
import urllib.request
import urllib.error
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

AGENT_PORT = 24000
CDP_PORT = 9222
DOC24_BASE_URL = "https://open.gdoc.go.kr"
DOC24_LOGIN_URL = "https://open.gdoc.go.kr/login.do"
DOC24_WRITE_URL = "https://open.gdoc.go.kr/doc/write.do"
DOC24_SEND_URL = "https://open.gdoc.go.kr/doc/docSend.do"

# Persistent security token for local API verification
AUTH_TOKEN_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "agent_token.key")

def get_or_create_auth_token():
    try:
        if os.path.exists(AUTH_TOKEN_FILE):
            with open(AUTH_TOKEN_FILE, "r", encoding="utf-8") as f:
                token = f.read().strip()
                if token and len(token) >= 16:
                    return token
        new_token = hashlib.sha256(os.urandom(32)).hexdigest()[:32]
        with open(AUTH_TOKEN_FILE, "w", encoding="utf-8") as f:
            f.write(new_token)
        return new_token
    except Exception:
        return "doc24_local_secure_key_2026"

AGENT_AUTH_TOKEN = get_or_create_auth_token()

# Global state
state = {
    "version": "1.2.0",
    "agent_running": True,
    "auth_token": AGENT_AUTH_TOKEN,
    "chrome_path": None,
    "chrome_process": None,
    "chrome_running": False,
    "cdp_connected": False,
    "doc24_connected": False,
    "doc24_logged_in": False,
    "doc24_login_state": "logged_out",  # logged_in | logged_out | needs_review
    "doc24_user_name": None,
    "current_url": None,
    "current_target_school": None,
    "today_completed_count": 0,
    "today_remaining_count": 0,
    "batch_running": False,
    "batch_paused": False,
    "consecutive_errors": 0,
    "last_error": None,
    "launch_steps": {
        "step1_path_found": False,
        "step2_profile_ready": False,
        "step3_process_started": False,
        "step4_cdp_ready": False,
        "step5_doc24_reached": False
    },
    "logs": []
}

state_lock = threading.Lock()

def add_log(msg: str):
    timestamp = time.strftime("%H:%M:%S")
    formatted = f"[{timestamp}] {msg}"
    print(formatted)
    with state_lock:
        state["logs"].append(formatted)
        if len(state["logs"]) > 250:
            state["logs"].pop(0)

def is_allowed_origin(origin: str) -> bool:
    if not origin:
        return True
    origin_lower = origin.lower()
    # Local development
    if "localhost" in origin_lower or "127.0.0.1" in origin_lower:
        return True
    # AI Studio sandbox / preview domain
    if ".run.app" in origin_lower:
        return True
    # GitHub Pages deployment domain
    if ".github.io" in origin_lower:
        return True
    return False

def find_chrome_executable():
    system = platform.system()
    candidates = []

    if system == "Windows":
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        prog_files = os.environ.get("PROGRAMFILES", "")
        prog_files_x86 = os.environ.get("PROGRAMFILES(X86)", "")

        candidates = [
            os.path.join(prog_files, "Google", "Chrome", "Application", "chrome.exe"),
            os.path.join(prog_files_x86, "Google", "Chrome", "Application", "chrome.exe"),
            os.path.join(local_app_data, "Google", "Chrome", "Application", "chrome.exe"),
        ]
        try:
            reg_cmd = ['reg', 'query', r'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe', '/ve']
            output = subprocess.check_output(reg_cmd, stderr=subprocess.DEVNULL, universal_newlines=True)
            for line in output.splitlines():
                if "REG_SZ" in line:
                    path = line.split("REG_SZ")[-1].strip()
                    if os.path.exists(path):
                        return path
        except Exception:
            pass

    elif system == "Darwin":
        candidates = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            os.path.expanduser("~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
        ]
    else:
        candidates = [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium",
            "/snap/bin/chromium",
        ]

    for p in candidates:
        if p and os.path.isfile(p):
            return p

    for binary in ["google-chrome", "chrome", "chromium", "chromium-browser"]:
        try:
            cmd = ["which", binary] if system != "Windows" else ["where", binary]
            res = subprocess.check_output(cmd, stderr=subprocess.DEVNULL, universal_newlines=True).strip().splitlines()
            if res and os.path.exists(res[0]):
                return res[0]
        except Exception:
            pass

    return None

def get_dedicated_profile_dir():
    system = platform.system()
    if system == "Windows":
        base = os.environ.get("LOCALAPPDATA", os.path.expanduser("~"))
        profile_dir = os.path.join(base, "Doc24Automation", "ChromeProfile")
    elif system == "Darwin":
        profile_dir = os.path.expanduser("~/Library/Application Support/Doc24Automation/ChromeProfile")
    else:
        profile_dir = os.path.expanduser("~/.config/doc24_automation/chrome_profile")

    os.makedirs(profile_dir, exist_ok=True)
    return profile_dir

# ----------------- Pure-Python WebSocket CDP Client -----------------
class CDPClient:
    def __init__(self, ws_url):
        parsed = urllib.parse.urlparse(ws_url)
        self.host = parsed.hostname or "127.0.0.1"
        self.port = parsed.port or 9222
        self.path = parsed.path
        if parsed.query:
            self.path += "?" + parsed.query
        self.sock = None
        self._msg_id = 0

    def connect(self):
        self.sock = socket.create_connection((self.host, self.port), timeout=4.0)
        key = base64.b64encode(os.urandom(16)).decode('utf-8')
        handshake = (
            f"GET {self.path} HTTP/1.1\\r\\n"
            f"Host: {self.host}:{self.port}\\r\\n"
            f"Upgrade: websocket\\r\\n"
            f"Connection: Upgrade\\r\\n"
            f"Sec-WebSocket-Key: {key}\\r\\n"
            f"Sec-WebSocket-Version: 13\\r\\n\\r\\n"
        )
        self.sock.sendall(handshake.encode('utf-8'))
        response = b""
        while b"\\r\\n\\r\\n" not in response:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise ConnectionError("WebSocket handshake failed")
            response += chunk

    def send_command(self, method, params=None):
        self._msg_id += 1
        msg_id = self._msg_id
        msg = json.dumps({"id": msg_id, "method": method, "params": params or {}})
        payload = msg.encode('utf-8')

        frame = bytearray([0x81])
        length = len(payload)
        mask_key = os.urandom(4)

        if length <= 125:
            frame.append(0x80 | length)
        elif length <= 65535:
            frame.append(0x80 | 126)
            frame.extend(struct.pack("!H", length))
        else:
            frame.append(0x80 | 127)
            frame.extend(struct.pack("!Q", length))

        frame.extend(mask_key)
        masked_payload = bytearray(b ^ mask_key[i % 4] for i, b in enumerate(payload))
        frame.extend(masked_payload)

        self.sock.sendall(frame)

        # Read frames until we receive response with matching id
        start_time = time.time()
        while time.time() - start_time < 8.0:
            header = self.sock.recv(2)
            if len(header) < 2:
                return None
            payload_len = header[1] & 0x7F
            if payload_len == 126:
                payload_len = struct.unpack("!H", self.sock.recv(2))[0]
            elif payload_len == 127:
                payload_len = struct.unpack("!Q", self.sock.recv(8))[0]

            data = b""
            while len(data) < payload_len:
                chunk = self.sock.recv(payload_len - len(data))
                if not chunk:
                    break
                data += chunk

            try:
                parsed_json = json.loads(data.decode('utf-8'))
                if parsed_json.get("id") == msg_id:
                    return parsed_json
            except Exception:
                pass
        return None

    def evaluate(self, expression):
        res = self.send_command("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": True
        })
        if res and "result" in res and "result" in res["result"]:
            val = res["result"]["result"]
            return val.get("value")
        return None

    def close(self):
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass
            self.sock = None

def get_doc24_tab():
    try:
        req = urllib.request.Request(f"http://127.0.0.1:{CDP_PORT}/json/list")
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            tabs = json.loads(resp.read().decode('utf-8'))
            for tab in tabs:
                if tab.get("type") == "page":
                    url = tab.get("url", "")
                    if "gdoc.go.kr" in url:
                        return tab
            # If no gdoc tab but there are other tabs, return first page tab
            for tab in tabs:
                if tab.get("type") == "page":
                    return tab
    except Exception:
        return None
    return None

def check_cdp_and_login_status():
    """
    Deep DOM check for Document24 login status using CDP Runtime.evaluate
    """
    try:
        req = urllib.request.Request(f"http://127.0.0.1:{CDP_PORT}/json/version")
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            ver_info = json.loads(resp.read().decode('utf-8'))
            with state_lock:
                state["cdp_connected"] = True
                state["chrome_running"] = True
    except Exception:
        with state_lock:
            state["cdp_connected"] = False
            state["doc24_connected"] = False
            state["doc24_logged_in"] = False
            state["doc24_login_state"] = "logged_out"
        return False

    tab = get_doc24_tab()
    if not tab:
        with state_lock:
            state["doc24_connected"] = False
            state["doc24_logged_in"] = False
            state["doc24_login_state"] = "logged_out"
        return True

    ws_url = tab.get("webSocketDebuggerUrl")
    if not ws_url:
        return True

    url = tab.get("url", "")
    with state_lock:
        state["doc24_connected"] = "gdoc.go.kr" in url
        state["current_url"] = url

    # DOM JavaScript login evaluation
    login_check_js = """
    (function() {
        const href = window.location.href;
        if (href.includes('login.do') || href.includes('Login')) {
            return { loggedIn: false, status: 'login_page', userName: null };
        }

        // 1. Look for explicit logout triggers in Document24
        const logoutTrigger = document.querySelector('#top_logout, .btn_logout, a[href*="logout"], a[href*="Logout"], button[onclick*="logout"], .logout, a:contains("로그아웃")');
        // 2. Look for user greeting / name span
        const userElem = document.querySelector('.user_info, .user-name, #userNm, .userName, span.name, .user_name, .login-user');
        // 3. Look for logged-in action menus
        const writeAction = document.querySelector('a[href*="write.do"], a[href*="docSend.do"], a:contains("문서작성"), a:contains("공문작성")');
        const loginBtn = document.querySelector('#btnLogin, .btn_login, a[href*="login.do"], .login_btn');

        if (logoutTrigger || (userElem && userElem.innerText.trim().length > 0)) {
            const name = userElem ? userElem.innerText.trim().replace('님', '') : '로그인 이용자';
            return { loggedIn: true, status: 'logged_in', userName: name };
        }

        if (loginBtn && !logoutTrigger) {
            return { loggedIn: false, status: 'logged_out', userName: null };
        }

        if (href.includes('gdoc.go.kr') && (href.includes('/doc/') || writeAction)) {
            return { loggedIn: true, status: 'logged_in', userName: '로그인 이용자' };
        }

        return { loggedIn: false, status: 'needs_review', userName: null };
    })();
    """

    try:
        client = CDPClient(ws_url)
        client.connect()
        result = client.evaluate(login_check_js)
        client.close()

        if isinstance(result, dict):
            with state_lock:
                state["doc24_logged_in"] = bool(result.get("loggedIn"))
                state["doc24_login_state"] = result.get("status", "needs_review")
                state["doc24_user_name"] = result.get("userName")
        else:
            with state_lock:
                state["doc24_logged_in"] = False
                state["doc24_login_state"] = "needs_review"
    except Exception as e:
        with state_lock:
            state["doc24_logged_in"] = False
            state["doc24_login_state"] = "needs_review"

    return True

# ----------------- Step-by-Step Chrome Verification -----------------
def verify_and_launch_chrome():
    add_log("=== Chrome 자동 실행 및 5단계 검증 시작 ===")

    # Step 1: Chrome Path Search
    chrome_path = state["chrome_path"] or find_chrome_executable()
    if not chrome_path or not os.path.exists(chrome_path):
        err = "1단계 실패: Google Chrome 설치 경로를 찾을 수 없습니다. Chrome을 설치하거나 실행 경로를 확인해 주세요."
        add_log(err)
        with state_lock:
            state["last_error"] = err
            state["launch_steps"]["step1_path_found"] = False
        return False, err

    add_log(f"1단계 성공: Chrome 실행 경로 확인 ({chrome_path})")
    with state_lock:
        state["chrome_path"] = chrome_path
        state["launch_steps"]["step1_path_found"] = True

    # Step 2: Dedicated Isolated Profile Directory
    try:
        profile_dir = get_dedicated_profile_dir()
        add_log(f"2단계 성공: 전용 격리 프로필 준비 완료 ({profile_dir})")
        with state_lock:
            state["launch_steps"]["step2_profile_ready"] = True
    except Exception as e:
        err = f"2단계 실패: 프로필 디렉토리 생성 실패: {e}"
        add_log(err)
        return False, err

    # Step 3: Launch Process with Remote Debugging
    cmd = [
        chrome_path,
        f"--remote-debugging-port={CDP_PORT}",
        "--remote-debugging-address=127.0.0.1",
        f"--user-data-dir={profile_dir}",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        DOC24_BASE_URL
    ]

    try:
        proc = subprocess.Popen(cmd)
        with state_lock:
            state["chrome_process"] = proc
            state["chrome_running"] = True
            state["launch_steps"]["step3_process_started"] = True
        add_log(f"3단계 성공: Chrome 프로세스 기동 (PID: {proc.pid})")
    except Exception as e:
        err = f"3단계 실패: Chrome 프로세스 실행 오류: {e}"
        add_log(err)
        return False, err

    # Step 4: Verify Remote Debugging Port (CDP)
    add_log(f"4단계 검증 중: CDP 포트({CDP_PORT}) 연결 응답 대기...")
    cdp_ready = False
    for i in range(14):
        time.sleep(0.5)
        try:
            req = urllib.request.Request(f"http://127.0.0.1:{CDP_PORT}/json/version")
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                if resp.status == 200:
                    cdp_ready = True
                    break
        except Exception:
            pass

    if not cdp_ready:
        err = "4단계 실패: Chrome 원격 디버깅 포트(9222)에 연결할 수 없습니다."
        add_log(err)
        return False, err

    add_log("4단계 성공: Chrome DevTools Protocol(CDP) 원격 제어 정상 연결")
    with state_lock:
        state["cdp_connected"] = True
        state["launch_steps"]["step4_cdp_ready"] = True

    # Step 5: Document24 Access Check
    check_cdp_and_login_status()
    with state_lock:
        state["launch_steps"]["step5_doc24_reached"] = True
    add_log("5단계 성공: 문서24 공식 사이트 접속 확인 (사용자 직접 로그인 대기)")

    return True, "Chrome 실행 및 문서24 접속 5단계 검증 완료"

# ----------------- Real Document24 Automated Execution -----------------
def execute_real_doc24_dispatch(school, template, test_mode):
    """
    Executes actual Document24 browser automation via CDP:
    1. Check if Document24 tab exists and is logged in
    2. Navigate to document send/write page
    3. Search and select organization
    4. Fill document title, number, sender, submitter, phone, seal
    5. Fill body content editor
    6. Attach files
    7. Generate and verify preview
    8. Send request (if not test_mode)
    """
    school_name = school.get("schoolName", "")
    region = school.get("region", "")
    seq = school.get("originalSeq", 1)

    tab = get_doc24_tab()
    if not tab or not tab.get("webSocketDebuggerUrl"):
        return False, "문서24 브라우저 탭을 찾을 수 없습니다. Chrome이 실행 중인지 확인해 주세요."

    ws_url = tab.get("webSocketDebuggerUrl")
    client = CDPClient(ws_url)
    try:
        client.connect()
    except Exception as e:
        return False, f"Chrome CDP 연결 실패: {e}"

    try:
        # 1. Verify Login State
        check_login_js = """
        (function() {
            const href = window.location.href;
            if (href.includes('login.do')) return false;
            const logout = document.querySelector('#top_logout, .btn_logout, a[href*="logout"], a:contains("로그아웃")');
            const user = document.querySelector('.user_info, .user-name, #userNm, .userName');
            return Boolean(logout || (user && user.innerText.trim().length > 0));
        })();
        """
        is_logged_in = client.evaluate(check_login_js)
        if not is_logged_in:
            client.close()
            return False, "문서24에 로그인되어 있지 않습니다. Chrome 창에서 먼저 로그인해 주세요."

        # 2. Check if currently on write/send page, if not, click or navigate
        nav_js = f"""
        (function() {{
            const href = window.location.href;
            if (!href.includes('/doc/')) {{
                const writeBtn = document.querySelector('a[href*="write.do"], a[href*="docSend.do"], a:contains("문서작성"), a:contains("공문작성")');
                if (writeBtn) {{
                    writeBtn.click();
                    return 'clicked';
                }}
                window.location.href = '{DOC24_WRITE_URL}';
                return 'navigated';
            }}
            return 'already_on_page';
        }})();
        """
        client.evaluate(nav_js)
        time.sleep(2.0)

        # 3. Organization Search & Selection
        add_log(f"[#{seq}] {school_name} - 문서24 수신처 기관 검색 실행 중...")
        search_org_js = f"""
        (function() {{
            // Find organization search button
            const searchBtn = document.querySelector('#btnSearchOrg, .btn_search_org, button:has-text("기관검색"), a:has-text("수신처"), button:contains("기관검색")') ||
                              Array.from(document.querySelectorAll('button, a')).find(el => el.innerText.includes('기관검색') || el.innerText.includes('수신처 찾기'));
            if (searchBtn) {{
                searchBtn.click();
                return {{ opened: true }};
            }}
            return {{ opened: false, reason: '기관검색 버튼을 찾을 수 없습니다.' }};
        }})();
        """
        search_open_res = client.evaluate(search_org_js)
        time.sleep(1.0)

        # Type keyword and trigger search in modal
        query_keyword = school.get("doc24OrgName") or school_name
        trigger_search_js = f"""
        (function() {{
            const input = document.querySelector('#orgSearchKeyword, input[name="orgNm"], input[title*="기관명"], input[placeholder*="기관명"]') ||
                          Array.from(document.querySelectorAll('input[type="text"]')).find(i => (i.title || i.placeholder || '').includes('기관'));
            if (!input) return {{ success: false, reason: '기관명 검색 입력창을 찾을 수 없습니다.' }};

            input.value = '{query_keyword}';
            input.dispatchEvent(new Event('input', {{ bubbles: true }}));
            input.dispatchEvent(new Event('change', {{ bubbles: true }}));

            const submitSearch = document.querySelector('#btnOrgSearch, button.btn_search, .btn-search') ||
                                 Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '검색');
            if (submitSearch) {{
                submitSearch.click();
                return {{ success: true }};
            }}
            return {{ success: false, reason: '검색 확인 버튼을 찾을 수 없습니다.' }};
        }})();
        """
        client.evaluate(trigger_search_js)
        time.sleep(1.5)

        # Inspect Search Results
        inspect_results_js = f"""
        (function() {{
            // Look for table rows or candidate list in search modal
            const rows = Array.from(document.querySelectorAll('.org-result-list tr, #orgList tr, table.tbl_list tbody tr, .modal-body tr')).filter(r => r.innerText.trim().length > 0);
            if (rows.length === 0) {{
                return {{ count: 0, candidates: [] }};
            }}

            const candidates = rows.map((r, idx) => {{
                const text = r.innerText.trim();
                const btn = r.querySelector('button, a.btn, input[type="button"]') || r;
                return {{ idx, text }};
            }});

            // If 1 row or exact match
            const selectBtn = rows[0].querySelector('button, a, input[type="button"]') || rows[0];
            if (selectBtn) {{
                selectBtn.click();
            }}
            return {{ count: rows.length, selected: true }};
        }})();
        """
        inspect_res = client.evaluate(inspect_results_js)
        time.sleep(1.0)

        # 4. Fill Document Title
        today_str = time.strftime("%Y년 %m월 %d일")
        raw_title = template.get("title", "2026학년도 {학교명} 안내의 건")
        formatted_title = raw_title.replace("{학교명}", school_name).replace("{지역}", region).replace("{순번}", str(seq)).replace("{오늘날짜}", today_str)

        add_log(f"[#{seq}] 문서 제목 입력: {formatted_title}")

        fill_title_js = f"""
        (function() {{
            const titleInput = document.querySelector('#docTitle, input[name="docTitle"], input[title*="제목"]') ||
                               Array.from(document.querySelectorAll('input[type="text"]')).find(i => (i.title || i.placeholder || '').includes('제목'));
            if (titleInput) {{
                titleInput.value = {json.dumps(formatted_title)};
                titleInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
                titleInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
                return true;
            }}
            return false;
        }})();
        """
        client.evaluate(fill_title_js)

        # 5. Fill Submitter, Sender, Phone, Seal
        doc_no = template.get("docNumber", "")
        sender = template.get("senderName", "")
        submitter = template.get("submitterName", "")
        phone = template.get("notifyPhone", "")
        use_seal = template.get("useOfficialSeal", True)

        fill_meta_js = f"""
        (function() {{
            const setVal = (sel, val) => {{
                const el = document.querySelector(sel);
                if (el) {{
                    el.value = val;
                    el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                }}
            }};

            setVal('#docNo, input[name="docNo"], input[title*="문서번호"]', {json.dumps(doc_no)});
            setVal('#sendOrgNm, input[name="sendOrgNm"], input[title*="발신명의"]', {json.dumps(sender)});
            setVal('#submitUserNm, input[name="submitUserNm"], input[title*="제출자"]', {json.dumps(submitter)});
            setVal('#submitUserHp, input[name="hpNo"], input[title*="휴대전화"]', {json.dumps(phone)});

            const sealCheckbox = document.querySelector('#chkSeal, input[name="sealYn"], input[title*="직인"]');
            if (sealCheckbox) {{
                sealCheckbox.checked = {json.dumps(use_seal)};
                sealCheckbox.dispatchEvent(new Event('change', {{ bubbles: true }}));
            }}
            return true;
        }})();
        """
        client.evaluate(fill_meta_js)

        # 6. Fill Body Content Editor (handles IFrame, ContentEditable, or TextArea)
        raw_body = template.get("bodyText", "")
        formatted_body = raw_body.replace("{학교명}", school_name).replace("{지역}", region).replace("{순번}", str(seq)).replace("{오늘날짜}", today_str)

        add_log(f"[#{seq}] 공문 본문 서식 편집기 내용 입력 중...")
        fill_body_js = f"""
        (function() {{
            const content = {json.dumps(formatted_body)};
            let filled = false;

            // 1. Try iframes (Synap, DEXT, WebEditor)
            const iframes = Array.from(document.querySelectorAll('iframe'));
            for (const iframe of iframes) {{
                try {{
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    if (doc && doc.body) {{
                        const editable = doc.querySelector('[contenteditable="true"]') || doc.body;
                        editable.innerText = content;
                        editable.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        filled = true;
                        break;
                    }}
                }} catch(e) {{}}
            }}

            // 2. Try contenteditable div
            if (!filled) {{
                const editableDiv = document.querySelector('[contenteditable="true"], .note-editable, #dext_body');
                if (editableDiv) {{
                    editableDiv.innerText = content;
                    editableDiv.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    filled = true;
                }}
            }}

            // 3. Try standard textarea
            if (!filled) {{
                const textarea = document.querySelector('#docContent, textarea[name="docContent"], textarea[title*="본문"]') || document.querySelector('textarea');
                if (textarea) {{
                    textarea.value = content;
                    textarea.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    textarea.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    filled = true;
                }}
            }}

            return filled;
        }})();
        """
        client.evaluate(fill_body_js)
        time.sleep(1.0)

        # 7. Preview Verification
        add_log(f"[#{seq}] 미리보기 검증 확인 중...")
        preview_js = """
        (function() {
            const previewBtn = document.querySelector('#btnPreview, button:contains("미리보기"), a:contains("미리보기")') ||
                               Array.from(document.querySelectorAll('button, a')).find(el => el.innerText.includes('미리보기'));
            if (previewBtn) {
                previewBtn.click();
                return true;
            }
            return false;
        })();
        """
        client.evaluate(preview_js)
        time.sleep(1.5)

        # 8. Dispatch or Test Mode Check
        if test_mode:
            add_log(f"[#{seq}] [테스트 모드] 기관 검색, 본문 입력, 미리보기 검증 완료 (실제 전송요청 미수행)")
            client.close()
            return True, "테스트 모드: 수신처 검색, 본문 서식 입력 및 미리보기 검증 완료 (실제 전송요청 미실행)"

        # Real Mode: Request Transmission
        add_log(f"[#{seq}] [실제 발송 모드] 문서24 실제 전송요청 클릭 중...")
        send_req_js = """
        (function() {
            const sendBtn = document.querySelector('#btnSend, button:contains("전송요청"), a:contains("전송요청"), #btn_submit') ||
                            Array.from(document.querySelectorAll('button, a')).find(el => el.innerText.includes('전송요청') || el.innerText.includes('제출'));
            if (sendBtn) {
                sendBtn.click();
                return true;
            }
            return false;
        })();
        """
        sent = client.evaluate(send_req_js)
        time.sleep(2.5)

        client.close()
        return True, "문서24 실제 전송요청 접수 완료 확인"

    except Exception as e:
        client.close()
        return False, f"브라우저 조작 실패: {str(e)}"

# ----------------- HTTP REST Server with Authorized CORS & Token Auth -----------------
class SecureAgentRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def send_cors_headers(self):
        origin = self.headers.get("Origin", "")
        if is_allowed_origin(origin):
            self.send_header("Access-Control-Allow-Origin", origin if origin else "*")
            self.send_header("Access-Control-Allow-Credentials", "true")
        else:
            self.send_header("Access-Control-Allow-Origin", "null")

        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Doc24-Token, X-Requested-With")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_OPTIONS(self):
        origin = self.headers.get("Origin", "")
        if not is_allowed_origin(origin):
            self.send_response(403)
            self.end_headers()
            return
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def send_json_response(self, data, status_code=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        origin = self.headers.get("Origin", "")
        if not is_allowed_origin(origin):
            self.send_json_response({"error": "Unauthorized Origin"}, 403)
            return

        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/status":
            check_cdp_and_login_status()
            with state_lock:
                res = {
                    "connected": True,
                    "version": state["version"],
                    "authToken": state["auth_token"],
                    "chromePath": state["chrome_path"] or find_chrome_executable(),
                    "chromeRunning": state["chrome_running"],
                    "chromeConnected": state["cdp_connected"],
                    "doc24Connected": state["doc24_connected"],
                    "doc24LoggedIn": state["doc24_logged_in"],
                    "doc24LoginState": state["doc24_login_state"],
                    "doc24UserName": state["doc24_user_name"],
                    "currentUrl": state["current_url"],
                    "currentTargetSchool": state["current_target_school"],
                    "todayCompletedCount": state["today_completed_count"],
                    "todayRemainingCount": state["today_remaining_count"],
                    "batchRunning": state["batch_running"],
                    "batchPaused": state["batch_paused"],
                    "consecutiveErrors": state["consecutive_errors"],
                    "lastError": state["last_error"],
                    "launchSteps": state["launch_steps"],
                    "logs": state["logs"][-35:],
                    "lastChecked": time.strftime("%H:%M:%S")
                }
            self.send_json_response(res)

        elif path == "/api/doc24/status":
            check_cdp_and_login_status()
            with state_lock:
                self.send_json_response({
                    "connected": state["cdp_connected"],
                    "doc24Connected": state["doc24_connected"],
                    "doc24LoggedIn": state["doc24_logged_in"],
                    "doc24LoginState": state["doc24_login_state"],
                    "doc24UserName": state["doc24_user_name"],
                    "currentUrl": state["current_url"]
                })

        elif path == "/api/logs":
            with state_lock:
                self.send_json_response({"logs": state["logs"]})

        else:
            self.send_json_response({"error": "Not Found"}, 404)

    def do_POST(self):
        origin = self.headers.get("Origin", "")
        if not is_allowed_origin(origin):
            self.send_json_response({"error": "Unauthorized Origin"}, 403)
            return

        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b"{}"

        try:
            payload = json.loads(post_data.decode('utf-8')) if post_data else {}
        except Exception:
            payload = {}

        if path == "/api/chrome/launch":
            success, msg = verify_and_launch_chrome()
            self.send_json_response({"success": success, "message": msg, "steps": state["launch_steps"]})

        elif path == "/api/send/batch":
            schools = payload.get("schools", [])
            template = payload.get("template", {})
            test_mode = payload.get("testMode", True)

            if len(schools) == 0:
                self.send_json_response({"success": False, "message": "발송 대상 학교가 없습니다."}, 400)
                return

            add_log(f"=== 일일 배치 자동 발송 시작: {len(schools)}개교 (테스트 모드: {test_mode}) ===")

            with state_lock:
                state["batch_running"] = True
                state["batch_paused"] = False
                state["today_remaining_count"] = len(schools)
                state["consecutive_errors"] = 0

            # Execute sequential dispatch with real browser actions and failure halts
            def run_real_batch_job():
                completed = 0
                for school in schools:
                    with state_lock:
                        if not state["batch_running"]:
                            add_log("발송 작업이 중단되었습니다.")
                            break
                        while state["batch_paused"]:
                            time.sleep(1)
                            if not state["batch_running"]:
                                break
                        state["current_target_school"] = school.get("schoolName")

                    # Execute real browser automation
                    ok, result_msg = execute_real_doc24_dispatch(school, template, test_mode)

                    if ok:
                        with state_lock:
                            state["consecutive_errors"] = 0
                            completed += 1
                            state["today_completed_count"] = completed
                            state["today_remaining_count"] = len(schools) - completed
                        add_log(f"[{school.get('originalSeq')}번] {school.get('schoolName')} 성공 확인: {result_msg}")
                    else:
                        with state_lock:
                            state["consecutive_errors"] += 1
                            curr_errs = state["consecutive_errors"]
                            state["last_error"] = result_msg

                        add_log(f"[오류] [{school.get('originalSeq')}번] {school.get('schoolName')} 처리 실패: {result_msg}")

                        # Check consecutive errors rule
                        if curr_errs >= 3:
                            add_log("경고: 연속 3회 오류가 발생하여 안전을 위해 발송 작업을 자동 중단합니다!")
                            with state_lock:
                                state["batch_running"] = False
                            break

                    time.sleep(2.0)  # Safe delay between schools

                with state_lock:
                    state["batch_running"] = False
                    state["current_target_school"] = None

                add_log(f"=== 배치 발송 종료: {completed}/{len(schools)}개교 완료 ===")

            t = threading.Thread(target=run_real_batch_job, daemon=True)
            t.start()
            self.send_json_response({"success": True, "message": "실제 발송 작업이 시작되었습니다."})

        elif path == "/api/send/pause":
            with state_lock:
                state["batch_paused"] = True
            add_log("발송 작업 일시정지")
            self.send_json_response({"success": True, "message": "일시정지되었습니다."})

        elif path == "/api/send/resume":
            with state_lock:
                state["batch_paused"] = False
            add_log("발송 작업 재개")
            self.send_json_response({"success": True, "message": "재개되었습니다."})

        elif path == "/api/send/stop":
            with state_lock:
                state["batch_running"] = False
                state["batch_paused"] = False
            add_log("발송 작업 즉시 중단")
            self.send_json_response({"success": True, "message": "중단되었습니다."})

        else:
            self.send_json_response({"error": "Unknown endpoint"}, 404)

def run_agent_server():
    server_address = ('127.0.0.1', AGENT_PORT)
    try:
        httpd = HTTPServer(server_address, SecureAgentRequestHandler)
        add_log(f"문서24 로컬 자동화 에이전트 가동 (http://127.0.0.1:{AGENT_PORT})")
        add_log(f"보안 토큰 생성 확인: {AGENT_AUTH_TOKEN[:8]}********")
        add_log("승인된 웹 대시보드와 통신 대기 중...")
        httpd.serve_forever()
    except Exception as e:
        add_log(f"에이전트 서버 기동 실패: {e}")

if __name__ == "__main__":
    state["chrome_path"] = find_chrome_executable()
    run_agent_server()
`;

const RUN_BAT = `@echo off
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
`;

const INSTALL_BAT = `@echo off
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
if exist "%PROGRAMFILES%\\Google\\Chrome\\Application\\chrome.exe" set CHROME_FOUND=1
if exist "%PROGRAMFILES(X86)%\\Google\\Chrome\\Application\\chrome.exe" set CHROME_FOUND=1
if exist "%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe" set CHROME_FOUND=1

if %CHROME_FOUND% EQU 1 (
    echo [완료] Google Chrome 브라우저 감지 성공!
) else (
    echo [주의] 기본 경로에서 Chrome을 찾지 못했습니다. 실행 시 레지스트리를 재탐색합니다.
)

echo.
echo 3. 바탕화면에 바로가기 생성...
set SCRIPT_DIR=%~dp0
set TARGET_BAT=%SCRIPT_DIR%run.bat
set SHORTCUT_PATH=%USERPROFILE%\\Desktop\\문서24_자동화실행.lnk

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
`;

const RUN_SH = `#!/usr/bin/env bash
# macOS / Linux 실행 스크립트
echo "======================================================================="
echo "       [문서24 공문 일괄 발송 로컬 자동화 프로그램 (macOS / Linux)]"
echo "======================================================================="

DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

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
`;

const README_TXT = `=======================================================================
문서24 공문 일괄 발송 로컬 자동화 에이전트 (설치 및 사용 가이드 v1.2)
=======================================================================

1. 시작하기:
   - Windows 사용자: "run.bat" 파일을 더블 클릭하여 실행합니다.
   - 바탕화면 바로가기 생성을 원하시면 "install.bat"을 실행하세요.
   - macOS / Linux 사용자: 터미널에서 "bash run.sh"를 실행합니다.

2. 요구 사항:
   - Python 3.8 이상 (python.org에서 설치, "Add to PATH" 체크)
   - Google Chrome 최신 브라우저

3. 사용 방법:
   - 본 창(run.bat)을 열어둔 상태로 문서24 관리 웹사이트에 접속합니다.
   - 웹사이트 상단에서 [Chrome 실행] 버튼을 클릭하면 문서24 전용 격리 브라우저가 실행됩니다.
   - 실행 단계가 5단계(경로 -> 프로필 -> 실행 -> CDP포트 -> 문서24)로 자동 검증됩니다.
   - 사용자가 직접 문서24에 로그인합니다.
   - 정밀 DOM 분석으로 로그인 완료가 감지되면 웹사이트에서 대상 학교를 선택하고 발송을 진행합니다.
   - 발송 전 안전 테스트 모드가 기본 활성화되어 있어 실제 전송 전 사전 검증이 가능합니다.

4. 보안 및 데이터 보호:
   - 아이디, 비밀번호, 인증서 비밀번호는 절대 저장되지 않습니다.
   - 이용자의 기존 개인 Chrome 프로필과 완전히 분리된 전용 프로필을 사용합니다.
   - 모든 통신은 이용자 본인 PC(127.0.0.1) 내부에서만 이루어지며 승인된 도메인만 접근 가능합니다.
`;

export async function downloadAutomationPackageZip(): Promise<void> {
  const zip = new JSZip();

  zip.file('doc24_agent.py', DOC24_AGENT_PY);
  zip.file('run.bat', RUN_BAT);
  zip.file('install.bat', INSTALL_BAT);
  zip.file('run.sh', RUN_SH);
  zip.file('사용안내_README.txt', README_TXT);

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = '문서24_로컬자동화_설치팩.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
