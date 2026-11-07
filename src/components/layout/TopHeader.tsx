import React, { useState } from 'react';
import { LocalProgramStatus, SchoolList } from '../../types';
import { localApi } from '../../services/localApi';
import { downloadAutomationPackageZip } from '../../services/agentDownloader';
import {
  Calendar,
  Layers,
  RefreshCw,
  Cpu,
  Globe,
  ChevronDown,
  Play,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ShieldCheck,
  ExternalLink,
  Clock,
} from 'lucide-react';

interface TopHeaderProps {
  collapsed: boolean;
  activeList: SchoolList | null;
  lists: SchoolList[];
  onSelectList: (listId: string) => void;
  localStatus: LocalProgramStatus;
  isCheckingStatus: boolean;
  onRefreshStatus: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  collapsed,
  activeList,
  lists,
  onSelectList,
  localStatus,
  isCheckingStatus,
  onRefreshStatus,
}) => {
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [isLaunchingChrome, setIsLaunchingChrome] = useState(false);
  const [launchResult, setLaunchResult] = useState<string | null>(null);

  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const formattedDate = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 (${
    days[now.getDay()]
  }요일)`;

  const handleLaunchChrome = async () => {
    setIsLaunchingChrome(true);
    setLaunchResult(null);
    try {
      const res = await localApi.launchChrome();
      setLaunchResult(res.message);
      await onRefreshStatus();
    } catch (err: any) {
      setLaunchResult(`실행 오류: ${err.message}`);
    } finally {
      setIsLaunchingChrome(false);
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 right-0 z-20 h-16 bg-white border-b border-slate-200 transition-all duration-200 ease-in-out px-6 flex items-center justify-between ${
          collapsed ? 'left-18' : 'left-64'
        }`}
      >
        {/* Left zone: Active list selector and breadcrumb */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800 whitespace-nowrap">문서24 공문 관리</span>
            <span className="text-slate-300">/</span>
          </div>

          {/* List Selector Dropdown */}
          <div className="relative group min-w-0">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 hover:border-slate-300 transition-colors cursor-pointer max-w-xs md:max-w-md">
              <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <select
                value={activeList?.id || ''}
                onChange={(e) => onSelectList(e.target.value)}
                className="bg-transparent border-none text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer truncate pr-3"
              >
                {lists.length === 0 ? (
                  <option value="">(등록된 명단 없음)</option>
                ) : (
                  lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name} ({list.totalCount}개교)
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Right zone: Date & Real-time Connection Status Indicators */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Quick Chrome Launch Button */}
          <button
            onClick={handleLaunchChrome}
            disabled={isLaunchingChrome || !localStatus.connected}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs ${
              !localStatus.connected
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : localStatus.chromeRunning
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            title={
              !localStatus.connected
                ? '로컬 에이전트(run.bat) 실행 후 사용 가능합니다.'
                : '원격 디버깅 전용 Chrome 및 문서24를 실행합니다.'
            }
          >
            <Play className={`w-3.5 h-3.5 ${isLaunchingChrome ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">
              {isLaunchingChrome ? 'Chrome 기동 중...' : localStatus.chromeRunning ? 'Chrome 실행 중' : 'Chrome 실행'}
            </span>
          </button>

          {/* Connection status cluster */}
          <div
            onClick={() => setShowStatusModal(true)}
            className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200 cursor-pointer hover:border-slate-300 transition-colors"
            title="클릭하여 8대 상세 연결 및 발송 상태 확인"
          >
            {/* Local automation status badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${
                localStatus.connected
                  ? 'bg-emerald-100/80 text-emerald-800'
                  : 'bg-rose-50 text-rose-700 border border-rose-200/60'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">
                {localStatus.connected ? '로컬 에이전트 연결됨' : '로컬 프로그램 미연결'}
              </span>
              <span className="md:hidden">{localStatus.connected ? '연결됨' : '미연결'}</span>
            </div>

            {/* Doc24 Login status badge */}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium hidden sm:flex ${
                localStatus.doc24LoggedIn
                  ? 'bg-emerald-100/80 text-emerald-800'
                  : 'bg-amber-50 text-amber-800 border border-amber-200/60'
              }`}
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>{localStatus.doc24LoggedIn ? '문서24 로그인됨' : '로그인 확인 전'}</span>
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
          </div>

          {/* Re-check button */}
          <button
            onClick={onRefreshStatus}
            disabled={isCheckingStatus}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors disabled:opacity-50"
            title="연결 상태 새로고침"
          >
            <RefreshCw
              className={`w-4 h-4 ${isCheckingStatus ? 'animate-spin text-blue-600' : ''}`}
            />
          </button>
        </div>
      </header>

      {/* DETAILED 8-STATUS MODAL */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setShowStatusModal(false)}
          />

          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative w-full max-w-xl bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden p-6 space-y-5 animate-in fade-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      로컬 자동화 및 발송 실시간 연동 현황
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      확인 시각: {localStatus.lastChecked || '방금'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1"
                >
                  닫기
                </button>
              </div>

              {launchResult && (
                <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg">
                  {launchResult}
                </div>
              )}

              {/* 5-Step Chrome Launch & Security Verification Checklist */}
              {localStatus.launchSteps && localStatus.connected && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1.5">
                  <div className="font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Chrome 자동 실행 5단계 검증</span>
                    <span className="text-[11px] text-slate-500 font-mono">Port 9222 / Isolated Profile</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <div className="flex items-center gap-1.5">
                      {localStatus.launchSteps.step1_path_found ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className={localStatus.launchSteps.step1_path_found ? "text-slate-800 font-medium" : "text-slate-500"}>
                        1. Chrome 설치 경로 탐색
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {localStatus.launchSteps.step2_profile_ready ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className={localStatus.launchSteps.step2_profile_ready ? "text-slate-800 font-medium" : "text-slate-500"}>
                        2. 전용 격리 프로필 생성
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {localStatus.launchSteps.step3_process_started ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className={localStatus.launchSteps.step3_process_started ? "text-slate-800 font-medium" : "text-slate-500"}>
                        3. 브라우저 프로세스 기동
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {localStatus.launchSteps.step4_cdp_ready ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className={localStatus.launchSteps.step4_cdp_ready ? "text-slate-800 font-medium" : "text-slate-500"}>
                        4. CDP 원격제어 포트 연결
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:col-span-2">
                      {localStatus.launchSteps.step5_doc24_reached ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className={localStatus.launchSteps.step5_doc24_reached ? "text-slate-800 font-medium" : "text-slate-500"}>
                        5. 문서24 공식 사이트 접속
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 8 Detailed Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* 1. 로컬 프로그램 연결 상태 */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">1. 로컬 자동화 프로그램</span>
                  <span className={`font-bold flex items-center gap-1 ${localStatus.connected ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {localStatus.connected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {localStatus.connected ? '정상 연결됨' : '미연결'}
                  </span>
                </div>

                {/* 2. Chrome 실행 상태 */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">2. Chrome 실행 상태</span>
                  <span className={`font-bold flex items-center gap-1 ${localStatus.chromeRunning ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {localStatus.chromeRunning ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {localStatus.chromeRunning ? '실행 중' : '미실행'}
                  </span>
                </div>

                {/* 3. Chrome 디버깅 연결 상태 */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">3. Chrome CDP 원격제어</span>
                  <span className={`font-bold flex items-center gap-1 ${localStatus.chromeConnected ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {localStatus.chromeConnected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {localStatus.chromeConnected ? '연결됨 (포트 9222)' : '미연결'}
                  </span>
                </div>

                {/* 4. 문서24 접속 상태 */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">4. 문서24 접속 상태</span>
                  <span className={`font-bold flex items-center gap-1 ${localStatus.doc24Connected ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {localStatus.doc24Connected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {localStatus.doc24Connected ? '접속 확인' : '미접속'}
                  </span>
                </div>

                {/* 5. 문서24 로그인 상태 */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">5. 문서24 로그인 상태</span>
                  <span className={`font-bold flex items-center gap-1 ${
                    localStatus.doc24LoginState === 'logged_in' || localStatus.doc24LoggedIn
                      ? 'text-emerald-700'
                      : localStatus.doc24LoginState === 'needs_review'
                      ? 'text-amber-700'
                      : 'text-amber-600'
                  }`}>
                    {localStatus.doc24LoginState === 'logged_in' || localStatus.doc24LoggedIn ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    {localStatus.doc24LoginState === 'logged_in' || localStatus.doc24LoggedIn
                      ? (localStatus.doc24UserName ? `로그인 완료 (${localStatus.doc24UserName})` : '로그인 완료')
                      : localStatus.doc24LoginState === 'needs_review'
                      ? '확인 필요'
                      : '로그인 필요'}
                  </span>
                </div>

                {/* 6. 현재 처리 중인 학교 */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">6. 현재 처리 학교</span>
                  <span className="font-bold text-blue-700 truncate max-w-[120px]">
                    {localStatus.currentTargetSchool || '대기 중'}
                  </span>
                </div>

                {/* 7. 오늘 발송 완료 건수 */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">7. 오늘 발송 완료</span>
                  <span className="font-bold text-emerald-700 tabular-nums">
                    {localStatus.todayCompletedCount}건
                  </span>
                </div>

                {/* 8. 오늘 남은 발송 건수 */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">8. 오늘 남은 건수</span>
                  <span className="font-bold text-slate-800 tabular-nums">
                    {localStatus.todayRemainingCount}건
                  </span>
                </div>
              </div>

              {/* Actions & Instructions */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleLaunchChrome}
                    disabled={isLaunchingChrome || !localStatus.connected}
                    className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    <Play className="w-3.5 h-3.5" />
                    자동화 Chrome 브라우저 실행
                  </button>

                  <button
                    onClick={downloadAutomationPackageZip}
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    프로그램 다운로드 (.zip)
                  </button>

                  <button
                    onClick={onRefreshStatus}
                    className="py-2 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
                  >
                    새로고침
                  </button>
                </div>

                {!localStatus.connected && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                    * 로컬 자동화 에이전트(run.bat)를 PC에서 실행하시면 상태가 실시간으로 '정상 연결'로 바뀝니다.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
