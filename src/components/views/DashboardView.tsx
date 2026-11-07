import { ActiveTab, AppSettings, LocalProgramStatus, SchoolItem, SchoolList } from '../../types';
import { DispatchBadge, PrecheckBadge } from '../common/StatusBadges';
import { downloadAutomationPackageZip } from '../../services/agentDownloader';
import {
  School,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Calendar,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  FileSpreadsheet,
  Upload,
  Play,
  RotateCcw,
  Cpu,
  Globe,
  Lock,
  Download,
  RefreshCw,
} from 'lucide-react';

interface DashboardViewProps {
  activeList: SchoolList | null;
  schools: SchoolItem[];
  settings: AppSettings;
  localStatus: LocalProgramStatus;
  isCheckingStatus: boolean;
  onRefreshStatus: () => void;
  onLaunchChrome: () => Promise<void>;
  onNavigate: (tab: ActiveTab) => void;
  onLoadSample: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  activeList,
  schools,
  settings,
  localStatus,
  isCheckingStatus,
  onRefreshStatus,
  onLaunchChrome,
  onNavigate,
  onLoadSample,
}) => {
  if (!activeList || schools.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-xs">
          <FileSpreadsheet className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">먼저 학교 명단을 업로드해 주세요.</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
          공문 발송 대상 학교 엑셀 파일(.xlsx, .csv)을 등록하면 원본 순번 유지, 하루 50개 자동 배치, 사전 점검 및 결과 관리를 원스톱으로 진행할 수 있습니다.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => onNavigate('lists')}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Upload className="w-4 h-4" />
            학교 명단 업로드하기
          </button>
          <button
            onClick={onLoadSample}
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 shadow-xs transition-colors"
          >
            <School className="w-4 h-4 text-blue-600" />
            샘플 명단으로 바로 체험하기 (75개교)
          </button>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const totalCount = schools.length;
  const completedCount = schools.filter((s) => s.dispatchStatus === 'success').length;
  const failedCount = schools.filter((s) => s.dispatchStatus === 'failed').length;
  const reviewCount = schools.filter(
    (s) => s.dispatchStatus === 'needs_review' || s.precheckStatus === 'needs_review' || s.precheckStatus === 'not_found'
  ).length;
  const waitingCount = schools.filter((s) => s.dispatchStatus === 'waiting').length;

  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Batch calculation based on daily quota
  const dailyQuota = settings.dailyQuota || 50;
  // Next scheduled batch calculation (strictly based on originalSeq)
  const lastProcessedSeq = schools
    .filter((s) => s.dispatchStatus !== 'waiting')
    .reduce((max, s) => Math.max(max, s.originalSeq), 0);

  const nextStartSeq = lastProcessedSeq < totalCount ? lastProcessedSeq + 1 : totalCount;
  const nextEndSeq = Math.min(nextStartSeq + dailyQuota - 1, totalCount);

  // Today's scheduled batch (batch of today)
  const currentBatchNumber = Math.ceil(nextStartSeq / dailyQuota) || 1;
  const todayBatchSchools = schools.slice(nextStartSeq - 1, nextEndSeq);

  // Recent processed schools
  const recentProcessed = [...schools]
    .filter((s) => s.dispatchStatus !== 'waiting')
    .sort((a, b) => (b.dispatchedAt || '').localeCompare(a.dispatchedAt || ''))
    .slice(0, 5);

  // Recent issues / error items
  const issueSchools = schools
    .filter((s) => s.dispatchStatus === 'failed' || s.dispatchStatus === 'needs_review' || s.precheckStatus === 'not_found')
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Page Title & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">발송 현황 대시보드</h1>
          <p className="text-xs text-slate-500 mt-1">
            명단: <strong className="text-slate-700 font-semibold">{activeList.name}</strong> · 하루 기준 {dailyQuota}개 자동 분할
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('batch')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Calendar className="w-3.5 h-3.5" />
            오늘의 배치 확인
          </button>
          <button
            onClick={() => onNavigate('execution')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Play className="w-3.5 h-3.5 text-blue-400" />
            발송 실행 패널
          </button>
        </div>
      </div>

      {/* 0. Real-time 8-Factor Automation & Connection Status Card (Section 8 Requirement) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                로컬 자동화 및 문서24 실시간 연동 상태 (8대 지표)
              </h3>
              <p className="text-[11px] text-slate-500">
                최종 확인: {localStatus.lastChecked || '연결 확인 전'} · 실제 상태가 확인된 항목만 정상으로 표시됩니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onLaunchChrome}
              disabled={!localStatus.connected}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-xs ${
                !localStatus.connected
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : localStatus.chromeRunning
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              {localStatus.chromeRunning ? 'Chrome 실행 중' : 'Chrome 실행'}
            </button>

            <button
              onClick={downloadAutomationPackageZip}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              title="Windows용 run.bat 등 로컬 에이전트 압축 다운로드"
            >
              <Download className="w-3.5 h-3.5" />
              프로그램 다운로드 (.zip)
            </button>

            <button
              onClick={onRefreshStatus}
              disabled={isCheckingStatus}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
              title="상태 새로고침"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* 8 Metric Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
          {/* 1. 로컬 프로그램 */}
          <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-slate-600">1. 로컬 에이전트</span>
            <span className={`font-bold flex items-center gap-1 ${localStatus.connected ? 'text-emerald-700' : 'text-rose-600'}`}>
              {localStatus.connected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {localStatus.connected ? '연결됨' : '미연결'}
            </span>
          </div>

          {/* 2. Chrome 실행 */}
          <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-slate-600">2. Chrome 실행</span>
            <span className={`font-bold flex items-center gap-1 ${localStatus.chromeRunning ? 'text-emerald-700' : 'text-slate-500'}`}>
              {localStatus.chromeRunning ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {localStatus.chromeRunning ? '실행 중' : '미실행'}
            </span>
          </div>

          {/* 3. Chrome 디버깅 연결 */}
          <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-slate-600">3. Chrome CDP 제어</span>
            <span className={`font-bold flex items-center gap-1 ${localStatus.chromeConnected ? 'text-emerald-700' : 'text-slate-500'}`}>
              {localStatus.chromeConnected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {localStatus.chromeConnected ? '제어 가능' : '미연결'}
            </span>
          </div>

          {/* 4. 문서24 접속 */}
          <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-slate-600">4. 문서24 사이트</span>
            <span className={`font-bold flex items-center gap-1 ${localStatus.doc24Connected ? 'text-emerald-700' : 'text-slate-500'}`}>
              {localStatus.doc24Connected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {localStatus.doc24Connected ? '접속 확인' : '미접속'}
            </span>
          </div>

          {/* 5. 문서24 로그인 */}
          <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-slate-600">5. 문서24 로그인</span>
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

          {/* 6. 현재 처리 학교 */}
          <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-slate-600">6. 현재 처리 학교</span>
            <span className="font-bold text-blue-700 truncate max-w-[110px]" title={localStatus.currentTargetSchool || '없음'}>
              {localStatus.currentTargetSchool || '대기 중'}
            </span>
          </div>

          {/* 7. 오늘 발송 완료 */}
          <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-slate-600">7. 오늘 발송 완료</span>
            <span className="font-bold text-emerald-700 tabular-nums">
              {completedCount}건
            </span>
          </div>

          {/* 8. 오늘 남은 건수 */}
          <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-slate-600">8. 오늘 남은 건수</span>
            <span className="font-bold text-slate-800 tabular-nums">
              {waitingCount}건
            </span>
          </div>
        </div>
      </div>

      {/* 1. Top KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Total */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">전체 학교 수</span>
            <School className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {totalCount.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-500">개교</span>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium text-emerald-700">발송 완료</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-700 tabular-nums">
              {completedCount.toLocaleString()}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium">
              {progressPercent}%
            </span>
          </div>
        </div>

        {/* Pending / Waiting */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium text-slate-700">발송 대기</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-700 tabular-nums">
              {waitingCount.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400">잔여 학교</span>
          </div>
        </div>

        {/* Review Needed */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium text-amber-700">확인필요</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-600 tabular-nums">
              {reviewCount.toLocaleString()}
            </span>
            <span className="text-[11px] text-amber-700 font-medium">보정 요망</span>
          </div>
        </div>

        {/* Failed */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium text-rose-700">발송 실패</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-600 tabular-nums">
              {failedCount.toLocaleString()}
            </span>
            <span className="text-[11px] text-rose-700 font-medium">재처리 대상</span>
          </div>
        </div>
      </div>

      {/* 2. Central Area: Today's Dispatch Batch & Overall Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Batch Card (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">
                  {currentBatchNumber}일차 배치
                </span>
                <h3 className="text-sm font-bold text-slate-900">오늘의 발송 대상 요약</h3>
              </div>
              <button
                onClick={() => onNavigate('batch')}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                전체 일일 배치 보기
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100 mb-4">
              <div>
                <span className="text-[11px] text-slate-500 block mb-1">오늘 발송 예정</span>
                <span className="text-xl font-bold text-slate-800 tabular-nums">
                  {todayBatchSchools.length}
                </span>
                <span className="text-xs text-slate-500 ml-1">개교</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block mb-1">배정 순번 범위</span>
                <span className="text-sm font-bold text-slate-800 tabular-nums">
                  {todayBatchSchools.length > 0
                    ? `${nextStartSeq}번 ~ ${nextEndSeq}번`
                    : '발송 완료됨'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block mb-1">다음 발송 예정 순번</span>
                <span className="text-sm font-bold text-blue-600 tabular-nums">
                  #{nextStartSeq}번
                </span>
              </div>
            </div>

            {/* Quick Preview Table of today's batch */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                    <th className="py-2 px-3 font-medium w-16">순번</th>
                    <th className="py-2 px-3 font-medium w-24">지역</th>
                    <th className="py-2 px-3 font-medium">학교명</th>
                    <th className="py-2 px-3 font-medium">사전점검</th>
                    <th className="py-2 px-3 font-medium w-24">발송상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {todayBatchSchools.slice(0, 4).map((school) => (
                    <tr key={school.id} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 font-mono font-medium text-slate-600">
                        #{school.originalSeq}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{school.region}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">{school.schoolName}</td>
                      <td className="py-2 px-3">
                        <PrecheckBadge status={school.precheckStatus} />
                      </td>
                      <td className="py-2 px-3">
                        <DispatchBadge status={school.dispatchStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {todayBatchSchools.length > 4 && (
                <div className="text-center py-2 text-[11px] text-slate-500 bg-slate-50/30 border-t border-slate-100">
                  외 {todayBatchSchools.length - 4}개 학교 대기 중
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>* 일부 실패 건이 발생해도 다음 일차는 원본 순번 기준으로 연속 배정됩니다.</span>
            <button
              onClick={() => onNavigate('execution')}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded text-xs transition-colors"
            >
              오늘 배치 발송 실행 준비
            </button>
          </div>
        </div>

        {/* Progress & Breakdown Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">전체 공문 발송 진행률</h3>
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>

            {/* Circular or Bar Progress */}
            <div className="py-2 text-center">
              <div className="text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                {progressPercent}%
              </div>
              <div className="text-xs text-slate-500 mt-1">
                전체 {totalCount}개 중 <strong>{completedCount}개</strong> 성공 완료
              </div>

              {/* Multi-segment Progress Bar */}
              <div className="w-full bg-slate-100 h-3 rounded-full mt-4 overflow-hidden flex">
                <div
                  style={{ width: `${(completedCount / totalCount) * 100}%` }}
                  className="bg-emerald-500 h-full transition-all"
                  title={`성공: ${completedCount}건`}
                />
                <div
                  style={{ width: `${(failedCount / totalCount) * 100}%` }}
                  className="bg-rose-500 h-full transition-all"
                  title={`실패: ${failedCount}건`}
                />
                <div
                  style={{ width: `${(reviewCount / totalCount) * 100}%` }}
                  className="bg-amber-500 h-full transition-all"
                  title={`확인필요: ${reviewCount}건`}
                />
              </div>

              {/* Progress legend */}
              <div className="grid grid-cols-3 gap-2 mt-4 text-xs pt-2 border-t border-slate-100">
                <div className="text-left">
                  <span className="text-[11px] text-slate-400 block">성공</span>
                  <span className="font-semibold text-emerald-700 tabular-nums">{completedCount}건</span>
                </div>
                <div className="text-left">
                  <span className="text-[11px] text-slate-400 block">실패</span>
                  <span className="font-semibold text-rose-700 tabular-nums">{failedCount}건</span>
                </div>
                <div className="text-left">
                  <span className="text-[11px] text-slate-400 block">확인필요</span>
                  <span className="font-semibold text-amber-700 tabular-nums">{reviewCount}건</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-lg text-xs text-amber-900 mt-4">
            <div className="flex items-center gap-1.5 font-semibold mb-1">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              업무 수칙 안내
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              문서24 시스템 안정성을 위해 일일 50개 발송 규정을 준수합니다. 실패한 건은 별도 재처리 목록에 보관됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Bottom Area: Recent Processed Schools & Issue Schools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Processed Schools */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">최근 처리 학교</h3>
            <button
              onClick={() => onNavigate('results')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              전체 결과 보기
            </button>
          </div>

          {recentProcessed.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              아직 발송 처리된 내역이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 px-2 font-medium">순번</th>
                    <th className="py-2 px-2 font-medium">지역</th>
                    <th className="py-2 px-2 font-medium">학교명</th>
                    <th className="py-2 px-2 font-medium">상태</th>
                    <th className="py-2 px-2 font-medium text-right">처리시각</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentProcessed.map((school) => (
                    <tr key={school.id} className="hover:bg-slate-50">
                      <td className="py-2 px-2 font-mono text-slate-500">#{school.originalSeq}</td>
                      <td className="py-2 px-2 text-slate-600">{school.region}</td>
                      <td className="py-2 px-2 font-medium text-slate-900 truncate max-w-[140px]">
                        {school.schoolName}
                      </td>
                      <td className="py-2 px-2">
                        <DispatchBadge status={school.dispatchStatus} />
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[11px] text-slate-500">
                        {school.dispatchedAt ? school.dispatchedAt.split(' ')[1] : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Issue / Needs Review List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-slate-900">최근 오류 및 확인필요 내역</h3>
              <span className="text-[11px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded font-mono">
                {reviewCount + failedCount}건
              </span>
            </div>
            <button
              onClick={() => onNavigate('precheck')}
              className="text-xs text-amber-700 hover:text-amber-800 font-medium"
            >
              사전점검에서 확인
            </button>
          </div>

          {issueSchools.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              현재 확인이 필요한 오류나 미일치 항목이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 px-2 font-medium">순번</th>
                    <th className="py-2 px-2 font-medium">학교명</th>
                    <th className="py-2 px-2 font-medium">상태</th>
                    <th className="py-2 px-2 font-medium">사유 / 메모</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {issueSchools.map((school) => (
                    <tr key={school.id} className="hover:bg-slate-50">
                      <td className="py-2 px-2 font-mono text-slate-500">#{school.originalSeq}</td>
                      <td className="py-2 px-2 font-medium text-slate-900 truncate max-w-[130px]">
                        {school.schoolName}
                      </td>
                      <td className="py-2 px-2">
                        {school.dispatchStatus === 'failed' ? (
                          <DispatchBadge status="failed" />
                        ) : (
                          <PrecheckBadge status={school.precheckStatus} />
                        )}
                      </td>
                      <td className="py-2 px-2 text-slate-500 truncate max-w-[180px] text-[11px]">
                        {school.memo || (school.precheckStatus === 'not_found' ? '기관 검색 결과 없음' : '확인 요망')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
