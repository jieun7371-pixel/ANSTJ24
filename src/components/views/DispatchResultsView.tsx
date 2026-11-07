import React, { useState } from 'react';
import { DispatchStatus, SchoolItem, SchoolList } from '../../types';
import { exportResultsToExcel } from '../../services/excelService';
import { DispatchBadge } from '../common/StatusBadges';
import { Modal } from '../common/Modal';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  Download,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  FileSpreadsheet,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface DispatchResultsViewProps {
  activeList: SchoolList | null;
  schools: SchoolItem[];
  onUpdateSchool: (school: SchoolItem) => Promise<void>;
  onDeleteSchool: (schoolId: string) => Promise<void>;
  onExtractFailedAsNewList: (failedItems: SchoolItem[], listName: string) => Promise<void>;
}

export const DispatchResultsView: React.FC<DispatchResultsViewProps> = ({
  activeList,
  schools,
  onUpdateSchool,
  onDeleteSchool,
  onExtractFailedAsNewList,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Edit result modal
  const [editingItem, setEditingItem] = useState<SchoolItem | null>(null);

  // Delete result confirmation
  const [itemToDelete, setItemToDelete] = useState<SchoolItem | null>(null);

  if (!activeList || schools.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-lg mx-auto">
        <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-800 mb-1">등록된 명단이 없습니다.</h3>
        <p className="text-xs text-slate-500 mb-4">
          발송 결과를 확인하려면 먼저 학교 명단 관리 화면에서 엑셀 파일을 업로드해 주세요.
        </p>
      </div>
    );
  }

  // Counts by status
  const totalCount = schools.length;
  const successCount = schools.filter((s) => s.dispatchStatus === 'success').length;
  const failedCount = schools.filter((s) => s.dispatchStatus === 'failed').length;
  const reviewCount = schools.filter((s) => s.dispatchStatus === 'needs_review').length;
  const waitingCount = schools.filter((s) => s.dispatchStatus === 'waiting').length;

  // Filtered
  const filteredSchools = schools.filter((s) => {
    if (statusFilter !== 'all' && s.dispatchStatus !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = s.schoolName.toLowerCase().includes(q);
      const matchRegion = s.region.toLowerCase().includes(q);
      const matchMemo = (s.memo || '').toLowerCase().includes(q);
      const matchSeq = String(s.originalSeq).includes(q);
      if (!matchName && !matchRegion && !matchMemo && !matchSeq) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredSchools.length / pageSize) || 1;
  const paginatedSchools = filteredSchools.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Extract failed and needs review items
  const handleExtractFailed = async () => {
    const targets = schools.filter(
      (s) => s.dispatchStatus === 'failed' || s.dispatchStatus === 'needs_review'
    );
    if (targets.length === 0) {
      alert('재처리할 실패 또는 확인필요 학교가 없습니다.');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const newName = `${activeList.name} (재발송 대상_${today})`;
    await onExtractFailedAsNewList(targets, newName);
  };

  // Handle Edit Submit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    await onUpdateSchool(editingItem);
    setEditingItem(null);
  };

  return (
    <div className="space-y-6">
      {/* Title & Top Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">발송 결과 관리</h1>
          <p className="text-xs text-slate-500 mt-1">
            학교별 발송 성공·실패 이력, 처리 시각 및 결과 엑셀(결과_YYYYMMDD.xlsx) 다운로드
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Extract Failed to new list button */}
          {(failedCount > 0 || reviewCount > 0) && (
            <button
              onClick={handleExtractFailed}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-lg border border-amber-300 transition-colors shadow-xs"
              title="실패 및 확인필요 학교만 별도 명단 카드로 추출"
            >
              <Layers className="w-3.5 h-3.5 text-amber-700" />
              오류/확인필요 학교 별도 명단 생성 ({failedCount + reviewCount}건)
            </button>
          )}

          {/* Export Results to Excel */}
          <button
            onClick={() => exportResultsToExcel(schools)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            결과 엑셀 다운로드 (결과_YYYYMMDD.xlsx)
          </button>
        </div>
      </div>

      {/* Status Segmented Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { key: 'all', label: '전체 결과', count: totalCount, icon: FileSpreadsheet, color: 'text-slate-800' },
          { key: 'success', label: '성공 확인', count: successCount, icon: CheckCircle2, color: 'text-emerald-700' },
          { key: 'failed', label: '실패 확인', count: failedCount, icon: XCircle, color: 'text-rose-700' },
          { key: 'needs_review', label: '확인필요', count: reviewCount, icon: AlertTriangle, color: 'text-amber-700' },
          { key: 'waiting', label: '발송 대기', count: waitingCount, icon: Clock, color: 'text-slate-600' },
        ].map((tab) => {
          const isActive = statusFilter === tab.key;
          const Icon = tab.icon;

          return (
            <button
              key={tab.key}
              onClick={() => {
                setStatusFilter(tab.key);
                setCurrentPage(1);
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                isActive
                  ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500/20 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>{tab.label}</span>
                <Icon className={`w-3.5 h-3.5 ${tab.color}`} />
              </div>
              <div className={`text-xl font-bold tabular-nums ${tab.color}`}>
                {tab.count.toLocaleString()}
                <span className="text-[10px] text-slate-400 font-normal ml-0.5">건</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search and Table */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="학교명, 지역, 처리메모 검색..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="text-xs text-slate-500">
          표시: <strong className="text-slate-800">{filteredSchools.length}</strong>개교
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                <th className="py-2.5 px-3 font-semibold w-16">순번</th>
                <th className="py-2.5 px-3 font-semibold w-24">지역</th>
                <th className="py-2.5 px-3 font-semibold">학교(기관)명</th>
                <th className="py-2.5 px-3 font-semibold w-28">발송 상태</th>
                <th className="py-2.5 px-3 font-semibold w-36">처리 시각</th>
                <th className="py-2.5 px-3 font-semibold">메모 / 결과 세부내역</th>
                <th className="py-2.5 px-3 font-semibold text-right w-20">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedSchools.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    해당 조건에 일치하는 발송 결과 항목이 없습니다.
                  </td>
                </tr>
              ) : (
                paginatedSchools.map((school) => (
                  <tr key={school.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-500">
                      #{school.originalSeq}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-medium">{school.region}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {school.schoolName}
                    </td>
                    <td className="py-2.5 px-3">
                      <DispatchBadge status={school.dispatchStatus} />
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                      {school.dispatchedAt || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-[11px] truncate max-w-[220px]">
                      {school.memo || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditingItem(school)}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          title="기록 수정"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setItemToDelete(school)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="기록 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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

      {/* EDIT MODAL */}
      {editingItem && (
        <Modal
          isOpen={Boolean(editingItem)}
          onClose={() => setEditingItem(null)}
          title="발송 결과 기록 수정"
          subtitle={`순번 #${editingItem.originalSeq} [${editingItem.region}] ${editingItem.schoolName}`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                발송 상태
              </label>
              <select
                value={editingItem.dispatchStatus}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    dispatchStatus: e.target.value as DispatchStatus,
                  })
                }
                className="w-full text-xs border border-slate-300 rounded-lg p-2 font-medium"
              >
                <option value="waiting">대기</option>
                <option value="sending">발송 중</option>
                <option value="success">성공 확인</option>
                <option value="failed">실패 확인</option>
                <option value="needs_review">확인필요</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                처리 시각
              </label>
              <input
                type="text"
                value={editingItem.dispatchedAt || ''}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, dispatchedAt: e.target.value })
                }
                placeholder="YYYY-MM-DD HH:mm:ss"
                className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                메모 / 오류 사유
              </label>
              <textarea
                value={editingItem.memo || ''}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, memo: e.target.value })
                }
                rows={3}
                placeholder="처리 특이사항 또는 오류 상세 원인"
                className="w-full text-xs border border-slate-300 rounded-lg p-2 font-medium"
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
                수정 저장
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* CONFIRMATION FOR DELETION */}
      {itemToDelete && (
        <ConfirmModal
          isOpen={Boolean(itemToDelete)}
          onClose={() => setItemToDelete(null)}
          onConfirm={() => onDeleteSchool(itemToDelete.id)}
          title="발송 결과 삭제 확인"
          message={`순번 #${itemToDelete.originalSeq} [${itemToDelete.region}] ${itemToDelete.schoolName} 학교의 발송 기록을 삭제하시겠습니까?`}
          confirmLabel="기록 삭제"
          isDestructive={true}
        />
      )}
    </div>
  );
};
