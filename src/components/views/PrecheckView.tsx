import React, { useState } from 'react';
import { LocalProgramStatus, PrecheckStatus, SchoolItem, SchoolList } from '../../types';
import { exportPrecheckToExcel, PRECHECK_STATUS_LABELS } from '../../services/excelService';
import { PrecheckBadge } from '../common/StatusBadges';
import { Modal } from '../common/Modal';
import {
  AlertTriangle,
  Download,
  Search,
  Filter,
  CheckCircle2,
  Cpu,
  Edit2,
  FileSpreadsheet,
  Layers,
  HelpCircle,
  Play,
} from 'lucide-react';

interface PrecheckViewProps {
  activeList: SchoolList | null;
  schools: SchoolItem[];
  localStatus: LocalProgramStatus;
  onUpdateSchool: (school: SchoolItem) => Promise<void>;
  onBatchUpdateSchools: (updatedSchools: SchoolItem[]) => Promise<void>;
}

export const PrecheckView: React.FC<PrecheckViewProps> = ({
  activeList,
  schools,
  localStatus,
  onUpdateSchool,
  onBatchUpdateSchools,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Manual Edit Precheck Result Modal
  const [editingItem, setEditingItem] = useState<SchoolItem | null>(null);

  if (!activeList || schools.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-lg mx-auto">
        <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-800 mb-1">등록된 명단이 없습니다.</h3>
        <p className="text-xs text-slate-500 mb-4">
          사전 점검을 진행하려면 먼저 학교 명단 관리 화면에서 엑셀 파일을 업로드해 주세요.
        </p>
      </div>
    );
  }

  // Precheck Status Counts
  const counts: Record<string, number> = {
    all: schools.length,
    not_checked: 0,
    exact_1: 0,
    not_found: 0,
    multiple_matches: 0,
    region_needed: 0,
    name_mismatch: 0,
    search_error: 0,
    needs_review: 0,
  };

  schools.forEach((s) => {
    if (counts[s.precheckStatus] !== undefined) {
      counts[s.precheckStatus]++;
    }
  });

  // Filtered Schools
  const filteredSchools = schools.filter((s) => {
    if (statusFilter !== 'all' && s.precheckStatus !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = s.schoolName.toLowerCase().includes(q);
      const matchRegion = s.region.toLowerCase().includes(q);
      const matchMatched = (s.matchedOrgName || '').toLowerCase().includes(q);
      const matchSeq = String(s.originalSeq).includes(q);
      if (!matchName && !matchRegion && !matchMatched && !matchSeq) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredSchools.length / pageSize) || 1;
  const paginatedSchools = filteredSchools.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Quick Action: Simulate local pre-check for testing when user wants to verify UI flows
  const handleSimulatePrecheckBatch = async () => {
    const updated = schools.map((s) => {
      if (s.precheckStatus !== 'not_checked') return s;

      // Realistic heuristic simulation for demo testing
      if (s.hasDuplicateName && s.isDuplicateDifferentRegion) {
        return {
          ...s,
          precheckStatus: 'region_needed' as PrecheckStatus,
          matchedOrgName: s.schoolName,
          matchedOrgDetail: `${s.region} 소재`,
          candidateCount: 2,
          memo: '동일 학교명 타지역 존재 (지역 필터 확인 요망)',
        };
      } else if (s.schoolName.includes('임의') || s.schoolName.includes('테스트')) {
        return {
          ...s,
          precheckStatus: 'not_found' as PrecheckStatus,
          matchedOrgName: '',
          candidateCount: 0,
          memo: '문서24 기관 검색 결과 없음',
        };
      } else {
        return {
          ...s,
          precheckStatus: 'exact_1' as PrecheckStatus,
          doc24OrgName: s.schoolName,
          matchedOrgName: s.schoolName,
          matchedOrgDetail: `${s.region} 교육지원청 관할`,
          candidateCount: 1,
        };
      }
    });

    await onBatchUpdateSchools(updated);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    await onUpdateSchool(editingItem);
    setEditingItem(null);
  };

  return (
    <div className="space-y-6">
      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">사전 점검 관리</h1>
          <p className="text-xs text-slate-500 mt-1">
            문서24 수신처 등록 여부, 기관명 일치 여부 및 동명 다수 후보 사전 확인
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportPrecheckToExcel(schools, activeList.name)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            점검 결과 엑셀 다운로드
          </button>
        </div>
      </div>

      {/* Mandatory Notification Banner when Local Automation is Not Connected */}
      {!localStatus.connected && (
        <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
          <Cpu className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-bold block text-sm mb-0.5">
              사전 점검 기능을 사용하려면 PC에 로컬 자동화 프로그램을 설치하고 연결해 주세요.
            </strong>
            <p className="text-amber-800 leading-relaxed mt-1">
              문서24 사이트 실시간 기관 검색은 이용자 PC의 Chrome 브라우저와 Python 로컬 에이전트를 통해 안전하게 수행됩니다.
              현재 웹 환경에서는 수동 점검 상태 수정 및 결과 엑셀 다운로드를 지원하며, 아래 버튼을 통해 모의 점검 데이터를 적용해 보실 수 있습니다.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleSimulatePrecheckBatch}
                className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1 shadow-xs"
              >
                <Play className="w-3 h-3" />
                모의 사전 점검 결과 일괄 적용 (체험용)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Segmented Buttons / Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {[
          { key: 'all', label: '전체', color: 'slate' },
          { key: 'exact_1', label: '1건 일치', color: 'emerald' },
          { key: 'not_found', label: '결과 없음', color: 'rose' },
          { key: 'multiple_matches', label: '동일 이름 여러 건', color: 'amber' },
          { key: 'region_needed', label: '지역 구분 필요', color: 'amber' },
          { key: 'name_mismatch', label: '이름 불일치', color: 'amber' },
          { key: 'needs_review', label: '확인필요', color: 'amber' },
          { key: 'not_checked', label: '점검 전', color: 'slate' },
        ].map((item) => {
          const isActive = statusFilter === item.key;
          const count = counts[item.key] ?? 0;

          return (
            <button
              key={item.key}
              onClick={() => {
                setStatusFilter(item.key);
                setCurrentPage(1);
              }}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                isActive
                  ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="text-[11px] text-slate-500 truncate">{item.label}</div>
              <div className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                {count}
                <span className="text-[10px] text-slate-400 font-normal ml-0.5">건</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="학교명, 검색 기관명, 지역 검색..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="text-xs text-slate-500">
          표시 대상: <strong className="text-slate-800">{filteredSchools.length}</strong>개교
        </div>
      </div>

      {/* Table of Precheck Results */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                <th className="py-2.5 px-3 font-semibold w-16">순번</th>
                <th className="py-2.5 px-3 font-semibold w-24">지역</th>
                <th className="py-2.5 px-3 font-semibold">엑셀 학교명</th>
                <th className="py-2.5 px-3 font-semibold">검색된 기관명</th>
                <th className="py-2.5 px-3 font-semibold">상세기관명</th>
                <th className="py-2.5 px-3 font-semibold w-20 text-center">후보수</th>
                <th className="py-2.5 px-3 font-semibold w-32">점검 결과</th>
                <th className="py-2.5 px-3 font-semibold text-right w-20">수정</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedSchools.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    해당 조건에 해당하는 사전 점검 항목이 없습니다.
                  </td>
                </tr>
              ) : (
                paginatedSchools.map((school) => (
                  <tr key={school.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-500">
                      #{school.originalSeq}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{school.region}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {school.schoolName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {school.matchedOrgName || (
                        <span className="text-slate-400 italic">미조회</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px] truncate max-w-[160px]">
                      {school.matchedOrgDetail || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                      {school.candidateCount ?? (school.precheckStatus === 'exact_1' ? 1 : 0)}
                    </td>
                    <td className="py-2.5 px-3">
                      <PrecheckBadge
                        status={school.precheckStatus}
                        candidateCount={school.candidateCount}
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => setEditingItem(school)}
                        className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100"
                        title="점검 결과 수동 지정"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            총 {filteredSchools.length}개 항목 중 {(currentPage - 1) * pageSize + 1} ~{' '}
            {Math.min(currentPage * pageSize, filteredSchools.length)}개
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
            >
              이전
            </button>
            <span className="px-2 font-mono font-medium">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
            >
              다음
            </button>
          </div>
        </div>
      </div>

      {/* Edit Precheck Result Modal */}
      {editingItem && (
        <Modal
          isOpen={Boolean(editingItem)}
          onClose={() => setEditingItem(null)}
          title="사전 점검 결과 수동 지정"
          subtitle={`순번 #${editingItem.originalSeq} [${editingItem.region}] ${editingItem.schoolName}`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                점검 결과 상태 선택
              </label>
              <select
                value={editingItem.precheckStatus}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    precheckStatus: e.target.value as PrecheckStatus,
                  })
                }
                className="w-full text-xs border border-slate-300 rounded-lg p-2 font-medium"
              >
                {Object.entries(PRECHECK_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                검색된 기관명
              </label>
              <input
                type="text"
                value={editingItem.matchedOrgName || ''}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, matchedOrgName: e.target.value })
                }
                className="w-full text-xs border border-slate-300 rounded-lg p-2 font-medium"
                placeholder="문서24 검색 결과 기관명"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                상세기관명 (관할 / 주소 등)
              </label>
              <input
                type="text"
                value={editingItem.matchedOrgDetail || ''}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, matchedOrgDetail: e.target.value })
                }
                className="w-full text-xs border border-slate-300 rounded-lg p-2 font-medium"
                placeholder="예: 서울 종로구 율곡로 교육지원청 관할"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                후보 개수
              </label>
              <input
                type="number"
                min={0}
                value={editingItem.candidateCount ?? 1}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, candidateCount: Number(e.target.value) })
                }
                className="w-full text-xs border border-slate-300 rounded-lg p-2 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                문서24 최종 등록 기관명 (확정명칭)
              </label>
              <input
                type="text"
                value={editingItem.doc24OrgName || ''}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, doc24OrgName: e.target.value })
                }
                className="w-full text-xs border border-slate-300 rounded-lg p-2 font-medium"
                placeholder="발송 시 실제 지정할 기관명"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                저장
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
