import React, { useState } from 'react';
import { AppSettings, DispatchStatus, SchoolItem, SchoolList } from '../../types';
import { DispatchBadge, PrecheckBadge } from '../common/StatusBadges';
import {
  Calendar,
  Layers,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  ListFilter,
  FileSpreadsheet,
  CalendarDays,
  Send,
  AlertTriangle,
  Play,
  ArrowRight,
} from 'lucide-react';

interface DailyBatchViewProps {
  activeList: SchoolList | null;
  schools: SchoolItem[];
  settings: AppSettings;
  onUpdateSchool: (school: SchoolItem) => Promise<void>;
  onBatchUpdateSchools: (updatedSchools: SchoolItem[]) => Promise<void>;
  onNavigate: (tab: any) => void;
}

export const DailyBatchView: React.FC<DailyBatchViewProps> = ({
  activeList,
  schools,
  settings,
  onUpdateSchool,
  onBatchUpdateSchools,
  onNavigate,
}) => {
  const [selectedBatchTab, setSelectedBatchTab] = useState<'today' | 'all_days' | 'reprocessing'>('today');
  const [customQuota, setCustomQuota] = useState<number>(settings.dailyQuota || 50);
  const [batchDate, setBatchDate] = useState<string>(new Date().toISOString().slice(0, 10));

  if (!activeList || schools.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-lg mx-auto">
        <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-800 mb-1">등록된 명단이 없습니다.</h3>
        <p className="text-xs text-slate-500 mb-4">
          일일 50개 발송 배치를 구성하려면 먼저 학교 명단 관리 화면에서 엑셀 파일을 등록해 주세요.
        </p>
      </div>
    );
  }

  const quota = customQuota > 0 ? customQuota : 50;
  const totalSchools = schools.length;
  const totalBatchesCount = Math.ceil(totalSchools / quota) || 1;

  // Calculate current active batch (the next batch that contains waiting items)
  // Strictly based on original sequence!
  const waitingSchools = schools.filter((s) => s.dispatchStatus === 'waiting');
  const firstWaitingSeq = waitingSchools.length > 0 ? waitingSchools[0].originalSeq : totalSchools;
  const currentBatchNumber = Math.ceil(firstWaitingSeq / quota) || 1;

  // Selected batch for viewing
  const [viewBatchNum, setViewBatchNum] = useState<number>(currentBatchNumber);

  // Range for viewBatchNum
  const batchStartSeq = (viewBatchNum - 1) * quota + 1;
  const batchEndSeq = Math.min(viewBatchNum * quota, totalSchools);
  const currentBatchSchools = schools.filter(
    (s) => s.originalSeq >= batchStartSeq && s.originalSeq <= batchEndSeq
  );

  // Reprocessing list: failed or needs_review items from ANY batch
  const reprocessingSchools = schools.filter(
    (s) => s.dispatchStatus === 'failed' || s.dispatchStatus === 'needs_review'
  );

  // Simulation: Mark today's batch as completed or failed for manual record tracking
  const handleMarkBatchStatus = async (status: DispatchStatus) => {
    const updated = currentBatchSchools.map((s) => ({
      ...s,
      dispatchStatus: status,
      dispatchedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      batchNumber: viewBatchNum,
      memo: status === 'failed' ? '수신처 응답 지연 (수동 표시)' : s.memo,
    }));
    await onBatchUpdateSchools(updated);
  };

  return (
    <div className="space-y-6">
      {/* Title & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">일일 발송 관리</h1>
          <p className="text-xs text-slate-500 mt-1">
            하루 기본 50개(조정 가능) 자동 순번 분할 및 원본 순번 기준 연속 배치 관리
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setSelectedBatchTab('today')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                selectedBatchTab === 'today'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              오늘의 발송 목록 ({currentBatchSchools.length})
            </button>
            <button
              onClick={() => setSelectedBatchTab('all_days')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                selectedBatchTab === 'all_days'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              전체 일차 계획 ({totalBatchesCount}일차)
            </button>
            <button
              onClick={() => setSelectedBatchTab('reprocessing')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                selectedBatchTab === 'reprocessing'
                  ? 'bg-white text-amber-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              재처리 관리
              {reprocessingSchools.length > 0 && (
                <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded font-bold font-mono">
                  {reprocessingSchools.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Batch Settings Strip */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            하루 발송 수량
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={10}
              max={200}
              value={customQuota}
              onChange={(e) => setCustomQuota(Number(e.target.value))}
              className="w-24 text-xs font-bold text-blue-700 border border-slate-300 rounded-lg p-1.5 focus:ring-1 focus:ring-blue-500 text-center"
            />
            <span className="text-xs text-slate-500">개 / 일 (기본 50)</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            배치 기준 일자
          </label>
          <input
            type="date"
            value={batchDate}
            onChange={(e) => setBatchDate(e.target.value)}
            className="w-full text-xs font-medium border border-slate-300 rounded-lg p-1.5"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            현재 대상 명단
          </label>
          <div className="text-xs font-bold text-slate-800 truncate py-1.5" title={activeList.name}>
            {activeList.name}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            전체 배치 계획 분할
          </label>
          <div className="text-xs text-slate-600 py-1.5 font-medium">
            총 {totalSchools}개교 → <strong className="text-blue-600">{totalBatchesCount}일차</strong> 자동 산출
          </div>
        </div>
      </div>

      {/* VIEW 1: TODAY'S DISPATCH LIST */}
      {selectedBatchTab === 'today' && (
        <div className="space-y-4">
          {/* Batch Selector Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewBatchNum((b) => Math.max(1, b - 1))}
                disabled={viewBatchNum === 1}
                className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-slate-900">
                  {viewBatchNum}일차 발송 배치
                </span>
                <span className="text-xs font-mono font-medium text-blue-600">
                  (원본 순번: #{batchStartSeq} ~ #{batchEndSeq})
                </span>
                {viewBatchNum === currentBatchNumber && (
                  <span className="text-[11px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded">
                    오늘 발송 권장
                  </span>
                )}
              </div>
              <button
                onClick={() => setViewBatchNum((b) => Math.min(totalBatchesCount, b + 1))}
                disabled={viewBatchNum >= totalBatchesCount}
                className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Quick manual simulation actions for testing */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleMarkBatchStatus('success')}
                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 transition-colors"
                title="오늘 배치 전원 성공 처리 (수동 기록용)"
              >
                전원 성공 처리
              </button>
              <button
                onClick={() => handleMarkBatchStatus('waiting')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                title="대기 상태로 리셋"
              >
                대기로 초기화
              </button>
              <button
                onClick={() => onNavigate('execution')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                발송 실행 화면으로 이동
              </button>
            </div>
          </div>

          {/* Today's Batch Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                    <th className="py-2.5 px-3 font-semibold w-16">순번</th>
                    <th className="py-2.5 px-3 font-semibold w-28">지역</th>
                    <th className="py-2.5 px-3 font-semibold">학교(기관)명</th>
                    <th className="py-2.5 px-3 font-semibold w-36">사전 점검 결과</th>
                    <th className="py-2.5 px-3 font-semibold w-28">발송 상태</th>
                    <th className="py-2.5 px-3 font-semibold text-right w-24">상태 변경</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentBatchSchools.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        배치에 속한 학교가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    currentBatchSchools.map((school) => (
                      <tr key={school.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-600">
                          #{school.originalSeq}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-medium">{school.region}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {school.schoolName}
                        </td>
                        <td className="py-2.5 px-3">
                          <PrecheckBadge status={school.precheckStatus} candidateCount={school.candidateCount} />
                        </td>
                        <td className="py-2.5 px-3">
                          <DispatchBadge status={school.dispatchStatus} />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <select
                            value={school.dispatchStatus}
                            onChange={(e) =>
                              onUpdateSchool({
                                ...school,
                                dispatchStatus: e.target.value as DispatchStatus,
                                dispatchedAt:
                                  e.target.value === 'success' || e.target.value === 'failed'
                                    ? new Date().toISOString().replace('T', ' ').slice(0, 19)
                                    : undefined,
                              })
                            }
                            className="text-[11px] bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-slate-700"
                          >
                            <option value="waiting">대기</option>
                            <option value="sending">발송 중</option>
                            <option value="success">성공</option>
                            <option value="failed">실패</option>
                            <option value="needs_review">확인필요</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div>
                * 오늘 발송 수량: 총 <strong>{currentBatchSchools.length}</strong>개교
              </div>
              <div className="flex items-center gap-3">
                <span className="text-emerald-700 font-medium">
                  성공: {currentBatchSchools.filter((s) => s.dispatchStatus === 'success').length}건
                </span>
                <span className="text-rose-700 font-medium">
                  실패: {currentBatchSchools.filter((s) => s.dispatchStatus === 'failed').length}건
                </span>
                <span className="text-slate-600">
                  대기: {currentBatchSchools.filter((s) => s.dispatchStatus === 'waiting').length}건
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: ALL DAYS BATCH OVERVIEW */}
      {selectedBatchTab === 'all_days' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: totalBatchesCount }, (_, idx) => {
            const bNum = idx + 1;
            const bStart = idx * quota + 1;
            const bEnd = Math.min((idx + 1) * quota, totalSchools);
            const bSchools = schools.filter(
              (s) => s.originalSeq >= bStart && s.originalSeq <= bEnd
            );
            const bSuccess = bSchools.filter((s) => s.dispatchStatus === 'success').length;
            const bFailed = bSchools.filter((s) => s.dispatchStatus === 'failed').length;
            const bWaiting = bSchools.filter((s) => s.dispatchStatus === 'waiting').length;
            const isToday = bNum === currentBatchNumber;

            return (
              <div
                key={bNum}
                className={`bg-white rounded-xl border p-4 shadow-xs transition-all flex flex-col justify-between ${
                  isToday ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{bNum}일차 배치</span>
                      {isToday && (
                        <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded">
                          오늘 대상
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono font-medium text-slate-500">
                      #{bStart} ~ #{bEnd}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 mb-3">
                    총 배정 학교: <strong className="text-slate-800">{bSchools.length}개교</strong>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 rounded-lg text-center text-xs mb-3">
                    <div>
                      <span className="text-[10px] text-slate-400 block">성공</span>
                      <span className="font-bold text-emerald-700 tabular-nums">{bSuccess}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">실패</span>
                      <span className="font-bold text-rose-700 tabular-nums">{bFailed}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">대기</span>
                      <span className="font-bold text-slate-700 tabular-nums">{bWaiting}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setViewBatchNum(bNum);
                    setSelectedBatchTab('today');
                  }}
                  className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center justify-center gap-1"
                >
                  상세 학교 목록 보기
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 3: REPROCESSING LIST (실패 및 확인필요 학교 별도 보관) */}
      {selectedBatchTab === 'reprocessing' && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50/70 border border-amber-200/70 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block mb-0.5">재처리(오류/확인필요) 관리 원칙</strong>
              <p className="text-amber-800 leading-relaxed">
                일부 학교가 실패하거나 확인필요 상태가 되어도 다음 일일 배치는 원본 순번 기준으로 정상 계속 진행됩니다.
                실패하거나 수신처 확인이 필요한 학교는 아래 재처리 목록에 안전하게 보존되며, 자동 재시도되지 않습니다.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                    <th className="py-2.5 px-3 font-semibold w-16">순번</th>
                    <th className="py-2.5 px-3 font-semibold w-28">지역</th>
                    <th className="py-2.5 px-3 font-semibold">학교(기관)명</th>
                    <th className="py-2.5 px-3 font-semibold w-28">발송 상태</th>
                    <th className="py-2.5 px-3 font-semibold">사유 / 메모</th>
                    <th className="py-2.5 px-3 font-semibold text-right w-24">상태 복구</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reprocessingSchools.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        재처리 대상(실패 또는 확인필요) 학교가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    reprocessingSchools.map((school) => (
                      <tr key={school.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-600">
                          #{school.originalSeq}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{school.region}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {school.schoolName}
                        </td>
                        <td className="py-2.5 px-3">
                          <DispatchBadge status={school.dispatchStatus} />
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                          {school.memo || '재확인 필요'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() =>
                              onUpdateSchool({
                                ...school,
                                dispatchStatus: 'waiting',
                                memo: '재발송 대기로 변경됨',
                              })
                            }
                            className="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-semibold border border-blue-200"
                          >
                            대기로 복귀
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
