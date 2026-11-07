export type PrecheckStatus =
  | 'not_checked'       // 점검 전
  | 'exact_1'           // 정확히 1건 일치
  | 'not_found'         // 검색 결과 없음
  | 'multiple_matches'  // 동일 이름 여러 건
  | 'region_needed'     // 지역 구분 필요
  | 'name_mismatch'     // 이름 불일치
  | 'search_error'      // 검색 오류
  | 'needs_review';     // 확인필요

export type DispatchStatus =
  | 'waiting'           // 대기
  | 'sending'           // 발송 중
  | 'success'           // 성공 확인
  | 'failed'            // 실패 확인
  | 'needs_review';     // 확인필요

export interface SchoolItem {
  id: string;
  listId: string;
  originalSeq: number;            // 원본 엑셀 행 순번 (1부터 시작)
  region: string;                 // 지역 / 시도
  schoolName: string;             // 원본 학교(기관)명
  doc24OrgName?: string;          // 문서24 등록 기관명 (확정/매핑된 기관명)
  matchedOrgName?: string;        // 사전점검 검색된 기관명
  matchedOrgDetail?: string;      // 상세기관명 (부서/위치 등)
  candidateCount?: number;        // 검색 후보 개수
  precheckStatus: PrecheckStatus; // 사전 점검 상태
  dispatchStatus: DispatchStatus; // 발송 상태
  dispatchedAt?: string;          // 발송 처리 일시 (YYYY-MM-DD HH:mm:ss)
  batchNumber?: number;           // 배정된 일일 배치 번호 (1, 2, 3...)
  memo?: string;                  // 처리 메모 및 오류 내용
  hasDuplicateName?: boolean;     // 명단 내 동일 학교명 존재 여부
  isDuplicateDifferentRegion?: boolean; // 지역이 다른 동명 학교 여부
  createdAt: string;
  updatedAt: string;
}

export interface SchoolList {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  totalCount: number;
  sourceFileName?: string;
  sourceSheetName?: string;
  columnMapping?: {
    schoolNameCol: string;
    regionCol?: string;
  };
}

export interface AppSettings {
  dailyQuota: number;              // 기본 일일 발송 수량 (기본 50)
  defaultDelaySec: number;         // 기본 대기 시간 (초)
  testModeDefault: boolean;        // 기본 테스트 모드 여부
  autoSelectExactMatch: boolean;   // 정확히 1건 일치 시 자동 선택 여부
  activeListId: string | null;     // 현재 선택된 명단 ID
  rowsPerPage: number;             // 페이지당 표시 수량
}

export interface BatchPlan {
  batchNumber: number;
  dayLabel: string;
  startSeq: number;
  endSeq: number;
  totalCount: number;
  schools: SchoolItem[];
}

export interface OfficialLetterTemplate {
  id: string;
  title: string;              // 문서 제목 (치환 변수 가능)
  docNumber: string;          // 문서번호
  senderName: string;         // 발신자명
  submitterName: string;      // 제출자명
  notifyPhone: string;        // 알림수신번호
  useOfficialSeal: boolean;   // 직인 날인 여부
  bodyText: string;           // 본문서식 내용 (치환 변수: {학교명}, {지역}, {순번}, {오늘날짜})
  createdAt: string;
  updatedAt: string;
}

export interface LocalProgramStatus {
  connected: boolean;               // 1. 로컬 자동화 프로그램 연결 상태
  chromeRunning: boolean;           // 2. Chrome 실행 상태
  chromeConnected: boolean;         // 3. Chrome 연결 상태
  doc24Connected: boolean;          // 4. 문서24 접속 상태
  doc24LoggedIn: boolean;           // 5. 문서24 로그인 상태
  currentTargetSchool?: string | null; // 6. 현재 처리 중인 학교
  todayCompletedCount: number;      // 7. 오늘 발송 완료 건수
  todayRemainingCount: number;      // 8. 오늘 남은 발송 건수
  doc24LoginState?: 'logged_in' | 'logged_out' | 'needs_review' | null;
  authToken?: string | null;
  launchSteps?: {
    step1_path_found?: boolean;
    step2_profile_ready?: boolean;
    step3_process_started?: boolean;
    step4_cdp_ready?: boolean;
    step5_doc24_reached?: boolean;
  };
  chromePath?: string | null;
  currentUrl?: string | null;
  doc24UserName?: string | null;
  version?: string;
  message?: string;
  lastError?: string | null;
  batchRunning?: boolean;
  batchPaused?: boolean;
  consecutiveErrors?: number;
  logs?: string[];
  lastChecked: string;
}

export type ActiveTab =
  | 'dashboard'
  | 'lists'
  | 'precheck'
  | 'batch'
  | 'execution'
  | 'results'
  | 'settings'
  | 'guide';
