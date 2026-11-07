import React from 'react';
import {
  HelpCircle,
  FileSpreadsheet,
  CheckCircle2,
  CalendarDays,
  Send,
  ClipboardCheck,
  ShieldCheck,
  Download,
  AlertCircle,
  ExternalLink,
  Cpu,
  Globe,
  Play,
  Lock,
} from 'lucide-react';
import { downloadSampleExcel } from '../../services/excelService';
import { downloadAutomationPackageZip } from '../../services/agentDownloader';

export const UserGuideView: React.FC = () => {
  return (
    <div className="space-y-8 max-w-4xl">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">문서24 공문 일괄 발송 운영 가이드</h1>
        <p className="text-xs text-slate-500 mt-1">
          로컬 자동화 프로그램 실행, Chrome 브라우저 연동, 공문 본문 작성 및 10단계 표준 업무 절차
        </p>
      </div>

      {/* Quick Download Banner */}
      <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-blue-200 block mb-0.5">원클릭 설치 및 실행</span>
          <h3 className="text-base font-bold">로컬 자동화 프로그램 패키지 다운로드</h3>
          <p className="text-xs text-blue-100 mt-1 max-w-md">
            Windows용 <code>run.bat</code>, 바로가기 생성기 <code>install.bat</code> 및 Python 자동화 에이전트가 포함된 ZIP 파일입니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadAutomationPackageZip}
            className="px-4 py-2 bg-white hover:bg-blue-50 text-blue-900 font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-blue-600" />
            로컬 프로그램 다운로드 (.zip)
          </button>
        </div>
      </div>

      {/* 1. 10-Step Standard Workflow (Section 10 Requirement) */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <HelpCircle className="w-5 h-5 text-blue-600" />
          공문 일괄 발송 10단계 표준 운영 절차
        </h2>

        <div className="space-y-5 text-xs">
          {/* Step 1 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 mt-0.5">
              1
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                1단계: 로컬 자동화 프로그램 실행 (run.bat)
              </h3>
              <p className="text-slate-600 leading-relaxed">
                다운로드한 <strong>[문서24_로컬자동화_설치팩.zip]</strong> 압축을 풀고 <code>run.bat</code>을 더블 클릭합니다.
                Python 3.8 이상이 설치되어 있으면 별도의 pip 라이브러리 설치 없이 즉시 로컬 서버(포트 24000)가 가동됩니다.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 mt-0.5">
              2
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                2단계: Chrome 자동 실행 및 원격 디버깅 활성화
              </h3>
              <p className="text-slate-600 leading-relaxed">
                웹 대시보드 상단의 <strong>[Chrome 실행]</strong> 버튼을 클릭합니다.
                프로그램이 사용자 PC의 Chrome 설치 경로를 자동 탐색하여 기존 개인 프로필과 격리된 <strong>전용 프로필</strong>로
                원격 디버깅 포트(9222)를 열고 문서24 공식 사이트(<code>https://open.gdoc.go.kr</code>)에 접속합니다.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 mt-0.5">
              3
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                3단계: 문서24 직접 로그인
              </h3>
              <p className="text-slate-600 leading-relaxed">
                실행된 전용 Chrome 창에서 사용자가 직접 공동인증서, 간편인증 또는 아이디로 로그인합니다.
                개인정보 보호 원칙에 따라 아이디, 비밀번호, 인증서 비밀번호는 웹사이트나 프로그램에 일체 저장되지 않습니다.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 mt-0.5">
              4
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                4단계: 로그인 상태 확인
              </h3>
              <p className="text-slate-600 leading-relaxed">
                로그인이 완료되면 웹사이트의 상단 배지가 <strong>[문서24 로그인 완료]</strong>로 자동 갱신됩니다.
                세션이 만료되거나 로그아웃되면 자동화 작업이 안전을 위해 즉시 중단됩니다.
              </p>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 mt-0.5">
              5
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                5단계: 학교 기관 검색 및 수신처 선택
              </h3>
              <p className="text-slate-600 leading-relaxed">
                엑셀 명단의 각 학교명을 기준으로 수신처를 검색합니다.
                동일한 이름의 학교가 전국에 여러 곳 있는 경우(예: 중앙중학교), 시스템이 임의로 추측하지 않고 관리자의 확인을 요청합니다.
              </p>
            </div>
          </div>

          {/* Step 6 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 mt-0.5">
              6
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                6단계: 공문 본문서식 작성 및 변수 치환 설정
              </h3>
              <p className="text-slate-600 leading-relaxed">
                [발송 실행] 메뉴의 본문서식 편집기에서 공문 내용을 작성하고 템플릿으로 저장합니다.
                본문에 <strong>{'{학교명}'}</strong>, <strong>{'{지역}'}</strong>, <strong>{'{순번}'}</strong>, <strong>{'{오늘날짜}'}</strong> 변수를 입력하면
                각 학교 발송 시 자동으로 실시간 치환되어 입력됩니다.
              </p>
            </div>
          </div>

          {/* Step 7 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 mt-0.5">
              7
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                7단계: 첨부파일 등록 및 실시간 미리보기
              </h3>
              <p className="text-slate-600 leading-relaxed">
                공문에 첨부할 파일들을 로컬에서 선택하고, <strong>[학교별 본문 실시간 미리보기]</strong> 버튼을 눌러
                대상 학교마다 공문이 올바르게 구성되었는지 사전에 육안으로 최종 점검합니다.
              </p>
            </div>
          </div>

          {/* Step 8 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 mt-0.5">
              8
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                8단계: 테스트 모드로 안전 검증 (기본 활성)
              </h3>
              <p className="text-slate-600 leading-relaxed">
                기본 활성화된 <strong>[테스트 모드]</strong>에서 발송을 시작하여 실제 전송요청 없이
                수신처 매핑, 본문 서식 입력, 첨부파일 등록까지의 전 과정을 안전하게 모의 검증합니다.
              </p>
            </div>
          </div>

          {/* Step 9 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 mt-0.5">
              9
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                9단계: 사용자 최종 승인 후 실제 발송 모드 전환
              </h3>
              <p className="text-slate-600 leading-relaxed">
                테스트 검증 후 <strong>[실제 발송 모드]</strong>로 전환합니다.
                발송 전 대상 학교 수, 공문 제목, 첨부파일 내역이 담긴 <strong>최종 승인 팝업</strong>에서 사용자가 명시적으로 동의해야만 실제 전송이 진행됩니다.
              </p>
            </div>
          </div>

          {/* Step 10 */}
          <div className="flex items-start gap-4">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 mt-0.5">
              10
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                10단계: 하루 50개 순차 발송 및 결과 저장 (결과_YYYYMMDD.xlsx)
              </h3>
              <p className="text-slate-600 leading-relaxed">
                원본 순번에 따라 하루 50개씩 순차 발송되며, 처리 시각과 결과가 브라우저 IndexedDB에 영구 보관됩니다.
                작업 종료 후 <strong>[발송 결과]</strong> 메뉴에서 <code>결과_YYYYMMDD.xlsx</code> 엑셀 파일로 결과를 다운로드하여 보관할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Security & Privacy Notice */}
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="font-bold text-sm block">보안 및 개인정보 보호 보장</strong>
          <p className="text-emerald-800 leading-relaxed">
            - 문서24 아이디, 비밀번호, 인증서 비밀번호는 어떤 파일이나 데이터베이스에도 저장되지 않습니다.<br />
            - 첨부파일 및 공문 내용은 외부 클라우드 서버로 일체 전송되지 않으며, 사용자 PC 내부(127.0.0.1)에서만 안전하게 처리됩니다.<br />
            - 크롬 원격 디버깅 포트(9222)는 로컬호스트에만 바인딩되어 외부 접근이 차단됩니다.
          </p>
        </div>
      </div>
    </div>
  );
};
