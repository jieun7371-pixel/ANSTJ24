import React, { useState, useRef } from 'react';
import { SchoolItem, SchoolList } from '../../types';
import {
  readExcelFile,
  analyzeColumns,
  processSheetRows,
  downloadSampleExcel,
  exportSchoolsToExcel,
  ParsedSheetData,
  ColumnSuggestion,
} from '../../services/excelService';
import { Modal } from '../common/Modal';
import { ConfirmModal } from '../common/ConfirmModal';
import { DispatchBadge, PrecheckBadge } from '../common/StatusBadges';
import {
  Upload,
  FileSpreadsheet,
  Download,
  Plus,
  Trash2,
  Edit2,
  Check,
  Search,
  Filter,
  AlertTriangle,
  ArrowUpDown,
  Layers,
  Sparkles,
  Eye,
  FileDown,
} from 'lucide-react';

interface ListManagementViewProps {
  lists: SchoolList[];
  activeList: SchoolList | null;
  schools: SchoolItem[];
  onSelectList: (listId: string) => void;
  onSaveNewList: (newList: SchoolList, items: SchoolItem[]) => Promise<void>;
  onAppendToList: (listId: string, items: SchoolItem[]) => Promise<void>;
  onReplaceList: (listId: string, items: SchoolItem[]) => Promise<void>;
  onRenameList: (listId: string, newName: string) => Promise<void>;
  onDeleteList: (listId: string) => Promise<void>;
  onUpdateSchool: (school: SchoolItem) => Promise<void>;
  onAddSchool: (school: Omit<SchoolItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDeleteSchool: (schoolId: string) => Promise<void>;
  onLoadSample: () => void;
}

export const ListManagementView: React.FC<ListManagementViewProps> = ({
  lists,
  activeList,
  schools,
  onSelectList,
  onSaveNewList,
  onAppendToList,
  onReplaceList,
  onRenameList,
  onDeleteList,
  onUpdateSchool,
  onAddSchool,
  onDeleteSchool,
  onLoadSample,
}) => {
  // Sub-tabs: 'lists_overview' or 'school_details'
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'details'>('overview');

  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Upload Wizard Modals
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedSheetData | null>(null);
  const [selectedSheetName, setSelectedSheetName] = useState<string>('');
  const [columnSuggestion, setColumnSuggestion] = useState<ColumnSuggestion | null>(null);
  const [selectedSchoolCol, setSelectedSchoolCol] = useState<number>(-1);
  const [selectedRegionCol, setSelectedRegionCol] = useState<number>(-1);
  const [hasHeaderRow, setHasHeaderRow] = useState<boolean>(true);
  const [uploadMode, setUploadMode] = useState<'new' | 'append' | 'replace'>('new');
  const [newListNameInput, setNewListNameInput] = useState<string>('');

  // Delete List Confirmation
  const [listToDelete, setListToDelete] = useState<SchoolList | null>(null);

  // Rename List Modal
  const [listToRename, setListToRename] = useState<SchoolList | null>(null);
  const [renameInput, setRenameInput] = useState<string>('');

  // School Detail Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 25;

  // Edit / Add School Modals
  const [editingSchool, setEditingSchool] = useState<SchoolItem | null>(null);
  const [isAddSchoolOpen, setIsAddSchoolOpen] = useState(false);
  const [schoolToDelete, setSchoolToDelete] = useState<SchoolItem | null>(null);

  // New School Form state
  const [newSchoolForm, setNewSchoolForm] = useState({
    region: '서울특별시',
    schoolName: '',
    doc24OrgName: '',
  });

  // Handle file selection (Drop or browse)
  const handleFileProcess = async (file: File) => {
    setUploadError(null);
    setIsUploading(true);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
        throw new Error('지원하지 않는 파일 형식입니다. .xlsx, .xls, .csv 파일만 업로드할 수 있습니다.');
      }

      const parsed = await readExcelFile(file);
      if (!parsed.sheetNames || parsed.sheetNames.length === 0) {
        throw new Error('엑셀 파일에서 유효한 시트를 찾을 수 없습니다.');
      }

      setParsedData(parsed);
      const firstSheet = parsed.sheetNames[0];
      setSelectedSheetName(firstSheet);

      // Analyze columns of first sheet
      const firstSheetRows = parsed.sheets[firstSheet] || [];
      const analysis = analyzeColumns(firstSheetRows);
      setColumnSuggestion(analysis);
      setSelectedSchoolCol(analysis.schoolColIdx);
      setSelectedRegionCol(analysis.regionColIdx);

      // Default name: file name without extension
      const defaultName = file.name.replace(/\.[^/.]+$/, '');
      setNewListNameInput(defaultName);
      setUploadMode(activeList ? 'new' : 'new');
      setIsWizardOpen(true);
    } catch (err: any) {
      setUploadError(err.message || '파일 처리 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  // Change active sheet in wizard
  const handleSheetChange = (sheetName: string) => {
    setSelectedSheetName(sheetName);
    if (parsedData) {
      const sheetRows = parsedData.sheets[sheetName] || [];
      const analysis = analyzeColumns(sheetRows);
      setColumnSuggestion(analysis);
      setSelectedSchoolCol(analysis.schoolColIdx);
      setSelectedRegionCol(analysis.regionColIdx);
    }
  };

  // Submit Upload Wizard
  const handleFinishUpload = async () => {
    if (!parsedData || !selectedSheetName) return;
    if (selectedSchoolCol < 0) {
      setUploadError('필수 항목인 [학교(기관)명] 열을 반드시 선택해 주세요.');
      return;
    }

    const sheetRows = parsedData.sheets[selectedSheetName] || [];
    const startRowIdx = hasHeaderRow ? 1 : 0;

    let targetListId = activeList?.id || `list_${Date.now()}`;
    let startSeq = 1;

    if (uploadMode === 'append' && activeList) {
      targetListId = activeList.id;
      startSeq = schools.length + 1;
    } else if (uploadMode === 'new') {
      targetListId = `list_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    }

    const { items, emptyRowCount, duplicateCount } = processSheetRows(
      sheetRows,
      startRowIdx,
      selectedSchoolCol,
      selectedRegionCol,
      targetListId,
      startSeq
    );

    if (items.length === 0) {
      setUploadError('선택한 열에서 유효한 학교명 데이터를 추출하지 못했습니다.');
      return;
    }

    const listName =
      uploadMode === 'new'
        ? newListNameInput.trim() || parsedData.fileName.replace(/\.[^/.]+$/, '')
        : activeList?.name || '학교 명단';

    const listMeta: SchoolList = {
      id: targetListId,
      name: listName,
      createdAt: uploadMode === 'append' && activeList ? activeList.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalCount: uploadMode === 'append' && activeList ? activeList.totalCount + items.length : items.length,
      sourceFileName: parsedData.fileName,
      sourceSheetName: selectedSheetName,
      columnMapping: {
        schoolNameCol: columnSuggestion?.headers[selectedSchoolCol] || `열 ${selectedSchoolCol + 1}`,
        regionCol:
          selectedRegionCol >= 0
            ? columnSuggestion?.headers[selectedRegionCol] || `열 ${selectedRegionCol + 1}`
            : undefined,
      },
    };

    if (uploadMode === 'append' && activeList) {
      await onAppendToList(activeList.id, items);
    } else if (uploadMode === 'replace' && activeList) {
      await onReplaceList(activeList.id, items);
    } else {
      await onSaveNewList(listMeta, items);
    }

    setIsWizardOpen(false);
    setParsedData(null);
    setActiveSubTab('details');
  };

  // Filter and sort schools for detail table
  const uniqueRegions = Array.from(new Set(schools.map((s) => s.region))).filter(Boolean);

  const filteredSchools = schools.filter((school) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = school.schoolName.toLowerCase().includes(q);
      const matchRegion = school.region.toLowerCase().includes(q);
      const matchDoc24 = (school.doc24OrgName || '').toLowerCase().includes(q);
      const matchSeq = String(school.originalSeq).includes(q);
      if (!matchName && !matchRegion && !matchDoc24 && !matchSeq) return false;
    }

    // Region filter
    if (selectedRegionFilter !== 'all' && school.region !== selectedRegionFilter) {
      return false;
    }

    // Status filter
    if (selectedStatusFilter !== 'all') {
      if (school.dispatchStatus !== selectedStatusFilter) return false;
    }

    return true;
  });

  const sortedSchools = [...filteredSchools].sort((a, b) => {
    if (sortDirection === 'asc') {
      return a.originalSeq - b.originalSeq;
    } else {
      return b.originalSeq - a.originalSeq;
    }
  });

  const totalPages = Math.ceil(sortedSchools.length / pageSize) || 1;
  const paginatedSchools = sortedSchools.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Handle school edit submit
  const handleSaveSchoolEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchool) return;
    await onUpdateSchool(editingSchool);
    setEditingSchool(null);
  };

  // Handle add school submit
  const handleSaveNewSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeList || !newSchoolForm.schoolName.trim()) return;

    const nextSeq = schools.length > 0 ? Math.max(...schools.map((s) => s.originalSeq)) + 1 : 1;

    await onAddSchool({
      listId: activeList.id,
      originalSeq: nextSeq,
      region: newSchoolForm.region.trim() || '미지정',
      schoolName: newSchoolForm.schoolName.trim(),
      doc24OrgName: newSchoolForm.doc24OrgName.trim(),
      precheckStatus: 'not_checked',
      dispatchStatus: 'waiting',
      batchNumber: Math.ceil(nextSeq / 50),
      hasDuplicateName: schools.some((s) => s.schoolName === newSchoolForm.schoolName.trim()),
    });

    setNewSchoolForm({ region: '서울특별시', schoolName: '', doc24OrgName: '' });
    setIsAddSchoolOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header and Sub-Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">학교 명단 관리</h1>
          <p className="text-xs text-slate-500 mt-1">
            엑셀 명단 파일 업로드, 열 매핑, 원본 순번 유지 및 상세 목록 관리
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setActiveSubTab('overview')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeSubTab === 'overview'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              명단 목록 ({lists.length})
            </button>
            <button
              onClick={() => setActiveSubTab('details')}
              disabled={!activeList}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors disabled:opacity-50 ${
                activeSubTab === 'details'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              상세 학교 목록 ({schools.length})
            </button>
          </div>

          {/* Sample Download Button */}
          <button
            onClick={downloadSampleExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-xs transition-colors"
            title="표준 엑셀 서식(.xlsx) 다운로드"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            샘플 양식 받기
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-semibold block">파일 처리 오류</strong>
            <span>{uploadError}</span>
          </div>
          <button
            onClick={() => setUploadError(null)}
            className="text-xs text-rose-600 hover:underline font-semibold"
          >
            닫기
          </button>
        </div>
      )}

      {/* SUB-VIEW 1: LISTS OVERVIEW & UPLOAD DROPZONE */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* File Upload Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              isDragOver
                ? 'border-blue-500 bg-blue-50/50'
                : 'border-slate-300 hover:border-slate-400 bg-white'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileProcess(e.target.files[0]);
                }
              }}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />

            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 border border-blue-100">
              <Upload className={`w-6 h-6 ${isUploading ? 'animate-bounce' : ''}`} />
            </div>

            <h3 className="text-sm font-bold text-slate-900 mb-1">
              엑셀 명단 파일 업로드 (.xlsx, .xls, .csv)
            </h3>
            <p className="text-xs text-slate-500 mb-4 max-w-md mx-auto">
              파일을 이곳에 끌어다 놓거나 아래 버튼을 눌러 선택하세요. 시트 선택 및 열 매핑 화면이 자동으로 열립니다.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                {isUploading ? '파일 분석 중...' : '파일 선택하기'}
              </button>
              <button
                type="button"
                onClick={onLoadSample}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                샘플 명단 자동 로드 (75개교)
              </button>
            </div>
          </div>

          {/* Uploaded Lists Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">
                보관 중인 학교 명단 ({lists.length}개)
              </h3>
              <span className="text-xs text-slate-500">
                카드를 클릭하여 활성 명단을 전환할 수 있습니다.
              </span>
            </div>

            {lists.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                아직 등록된 학교 명단이 없습니다. 위 영역에서 엑셀 파일을 업로드해 주세요.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lists.map((list) => {
                  const isActive = activeList?.id === list.id;
                  const dateStr = new Date(list.createdAt).toLocaleDateString('ko-KR');

                  return (
                    <div
                      key={list.id}
                      className={`relative bg-white rounded-xl border p-4 transition-all flex flex-col justify-between ${
                        isActive
                          ? 'border-blue-500 ring-2 ring-blue-500/10 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div>
                        {/* Header of Card */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900 truncate" title={list.name}>
                                {list.name}
                              </span>
                              {isActive && (
                                <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0">
                                  선택됨
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              등록일: {dateStr}
                            </span>
                          </div>

                          {/* Quick Actions Dropdown / Buttons */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setListToRename(list);
                                setRenameInput(list.name);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              title="명단 이름 변경"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setListToDelete(list)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="명단 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* List Metadata Details */}
                        <div className="grid grid-cols-2 gap-2 my-3 p-2.5 bg-slate-50 rounded-lg text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block">전체 학교</span>
                            <span className="font-semibold text-slate-800 tabular-nums">
                              {list.totalCount.toLocaleString()}개
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">원본 파일명</span>
                            <span className="text-[11px] text-slate-600 truncate block" title={list.sourceFileName}>
                              {list.sourceFileName || '직접 입력'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Action Footer */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          onClick={() => {
                            onSelectList(list.id);
                            setActiveSubTab('details');
                          }}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${
                            isActive
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {isActive ? '상세 목록 보기' : '명단 선택 및 보기'}
                        </button>
                        <button
                          onClick={() => exportSchoolsToExcel(schools, list.name)}
                          disabled={!isActive}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                          title="엑셀로 내보내기"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: SCHOOL DETAILS TABLE */}
      {activeSubTab === 'details' && (
        <div className="space-y-4">
          {/* Controls Bar: Search, Filters, Add School, Export */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="학교명, 순번, 지역 검색..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Filter cluster */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Region Filter */}
              <select
                value={selectedRegionFilter}
                onChange={(e) => {
                  setSelectedRegionFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:bg-white"
              >
                <option value="all">전체 지역</option>
                {uniqueRegions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatusFilter}
                onChange={(e) => {
                  setSelectedStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:bg-white"
              >
                <option value="all">전체 발송 상태</option>
                <option value="waiting">대기</option>
                <option value="sending">발송 중</option>
                <option value="success">성공 확인</option>
                <option value="failed">실패 확인</option>
                <option value="needs_review">확인필요</option>
              </select>

              {/* Sort Order Toggle */}
              <button
                onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="flex items-center gap-1 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 transition-colors"
                title="원본 순번 정렬 변경"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                <span>{sortDirection === 'asc' ? '순번 오름차순' : '순번 내림차순'}</span>
              </button>

              {/* Add school button */}
              <button
                onClick={() => setIsAddSchoolOpen(true)}
                className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-3 py-1.5 shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                학교 추가
              </button>

              {/* Export to Excel */}
              <button
                onClick={() => activeList && exportSchoolsToExcel(schools, activeList.name)}
                className="flex items-center gap-1 text-xs bg-white hover:bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 shadow-xs transition-colors"
                title="현재 명단 엑셀 다운로드"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                엑셀 내보내기
              </button>
            </div>
          </div>

          {/* School List Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                    <th className="py-2.5 px-3 font-semibold w-16">순번</th>
                    <th className="py-2.5 px-3 font-semibold w-28">지역</th>
                    <th className="py-2.5 px-3 font-semibold">학교(기관)명</th>
                    <th className="py-2.5 px-3 font-semibold">문서24 등록 기관명</th>
                    <th className="py-2.5 px-3 font-semibold w-28">사전 점검</th>
                    <th className="py-2.5 px-3 font-semibold w-24">발송 상태</th>
                    <th className="py-2.5 px-3 font-semibold text-right w-24">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedSchools.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        조건에 일치하는 학교가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    paginatedSchools.map((school) => (
                      <tr key={school.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Original Seq */}
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-600">
                          #{school.originalSeq}
                        </td>

                        {/* Region */}
                        <td className="py-2.5 px-3 text-slate-600 font-medium">{school.region}</td>

                        {/* School Name */}
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{school.schoolName}</span>
                            {school.hasDuplicateName && (
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                  school.isDuplicateDifferentRegion
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                                title={
                                  school.isDuplicateDifferentRegion
                                    ? '지역이 다른 동명 학교입니다.'
                                    : '명단 내 동일 학교명이 중복되어 있습니다.'
                                }
                              >
                                {school.isDuplicateDifferentRegion ? '동명(타지역)' : '중복'}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Doc24 Org Name */}
                        <td className="py-2.5 px-3 text-slate-600">
                          {school.doc24OrgName ? (
                            <span className="font-medium text-blue-700">{school.doc24OrgName}</span>
                          ) : (
                            <span className="text-slate-400 italic">미지정 (검색 전)</span>
                          )}
                        </td>

                        {/* Precheck Status */}
                        <td className="py-2.5 px-3">
                          <PrecheckBadge
                            status={school.precheckStatus}
                            candidateCount={school.candidateCount}
                          />
                        </td>

                        {/* Dispatch Status */}
                        <td className="py-2.5 px-3">
                          <DispatchBadge status={school.dispatchStatus} />
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditingSchool(school)}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              title="학교 정보 수정"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setSchoolToDelete(school)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="삭제"
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

            {/* Pagination footer */}
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div>
                총 <strong>{sortedSchools.length}</strong>개 학교 중 {(currentPage - 1) * pageSize + 1} ~{' '}
                {Math.min(currentPage * pageSize, sortedSchools.length)}개 표시
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
        </div>
      )}

      {/* MODAL 1: Upload & Column Mapping Wizard */}
      {isWizardOpen && parsedData && (
        <Modal
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          title="엑셀 명단 업로드 및 열 매핑"
          subtitle={`파일: ${parsedData.fileName}`}
          maxWidth="2xl"
        >
          <div className="space-y-5">
            {/* 1. Sheet selection if multiple sheets */}
            {parsedData.sheetNames.length > 1 && (
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  작업할 시트 선택
                </label>
                <div className="flex flex-wrap gap-2">
                  {parsedData.sheetNames.map((sheet) => (
                    <button
                      key={sheet}
                      type="button"
                      onClick={() => handleSheetChange(sheet)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        selectedSheetName === sheet
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {sheet}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Column Mapping Dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  <span className="text-rose-500 mr-1">*</span>
                  학교(기관)명 열 선택 (필수)
                </label>
                <select
                  value={selectedSchoolCol}
                  onChange={(e) => setSelectedSchoolCol(Number(e.target.value))}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value={-1}>-- 학교명 열을 선택하세요 --</option>
                  {columnSuggestion?.headers.map((header, idx) => (
                    <option key={idx} value={idx}>
                      열 {idx + 1}: {header}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  추천: 학교명, 기관명, 초·중·고교명이 위치한 열
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  지역 / 소속 구분 열 선택 (선택)
                </label>
                <select
                  value={selectedRegionCol}
                  onChange={(e) => setSelectedRegionCol(Number(e.target.value))}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value={-1}>(선택 안 함 / 전국 공통)</option>
                  {columnSuggestion?.headers.map((header, idx) => (
                    <option key={idx} value={idx}>
                      열 {idx + 1}: {header}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  시도/시군구 등 동명 기관 구분에 활용됩니다.
                </span>
              </div>
            </div>

            {/* 3. Preview first 5 rows */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-800">
                  데이터 미리보기 (상위 5행)
                </span>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasHeaderRow}
                    onChange={(e) => setHasHeaderRow(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  첫 번째 행을 제목(헤더)으로 인식
                </label>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-1.5 px-2.5 font-mono w-10">행</th>
                      {columnSuggestion?.headers.map((h, idx) => (
                        <th
                          key={idx}
                          className={`py-1.5 px-2.5 font-semibold ${
                            idx === selectedSchoolCol
                              ? 'bg-blue-50 text-blue-800 border-b-2 border-blue-500'
                              : idx === selectedRegionCol
                              ? 'bg-amber-50 text-amber-800 border-b-2 border-amber-500'
                              : ''
                          }`}
                        >
                          {h}
                          {idx === selectedSchoolCol && ' (학교명)'}
                          {idx === selectedRegionCol && ' (지역)'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(parsedData.sheets[selectedSheetName] || [])
                      .slice(hasHeaderRow ? 1 : 0, (hasHeaderRow ? 1 : 0) + 5)
                      .map((row, rIdx) => (
                        <tr key={rIdx}>
                          <td className="py-1.5 px-2.5 font-mono text-slate-400">
                            {hasHeaderRow ? rIdx + 2 : rIdx + 1}
                          </td>
                          {columnSuggestion?.headers.map((_, cIdx) => (
                            <td
                              key={cIdx}
                              className={`py-1.5 px-2.5 text-slate-700 truncate max-w-[150px] ${
                                cIdx === selectedSchoolCol
                                  ? 'bg-blue-50/40 font-medium'
                                  : cIdx === selectedRegionCol
                                  ? 'bg-amber-50/40'
                                  : ''
                              }`}
                            >
                              {String(row[cIdx] || '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Upload Mode: New list vs Append vs Replace */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-800 block">명단 반영 방식</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setUploadMode('new')}
                  className={`p-3 rounded-lg border text-left text-xs transition-colors ${
                    uploadMode === 'new'
                      ? 'border-blue-500 bg-blue-50/60 text-blue-900 font-semibold'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold mb-0.5">새 명단으로 생성</div>
                  <span className="text-[11px] text-slate-500 font-normal">
                    독립된 신규 명단 카드로 저장
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!activeList}
                  onClick={() => setUploadMode('append')}
                  className={`p-3 rounded-lg border text-left text-xs transition-colors disabled:opacity-40 ${
                    uploadMode === 'append'
                      ? 'border-blue-500 bg-blue-50/60 text-blue-900 font-semibold'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold mb-0.5">기존 명단에 추가</div>
                  <span className="text-[11px] text-slate-500 font-normal">
                    현재 명단 끝에 순번 이어서 추가
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!activeList}
                  onClick={() => setUploadMode('replace')}
                  className={`p-3 rounded-lg border text-left text-xs transition-colors disabled:opacity-40 ${
                    uploadMode === 'replace'
                      ? 'border-rose-500 bg-rose-50/60 text-rose-900 font-semibold'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold mb-0.5 text-rose-700">기존 명단 교체</div>
                  <span className="text-[11px] text-slate-500 font-normal">
                    현재 명단의 학교 목록을 덮어쓰기
                  </span>
                </button>
              </div>

              {uploadMode === 'new' && (
                <div className="mt-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    새 명단 이름
                  </label>
                  <input
                    type="text"
                    value={newListNameInput}
                    onChange={(e) => setNewListNameInput(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 font-medium"
                    placeholder="명단 이름을 입력하세요"
                  />
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsWizardOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleFinishUpload}
                disabled={selectedSchoolCol < 0}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs disabled:opacity-50"
              >
                명단 등록 완료
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2: Rename List Modal */}
      {listToRename && (
        <Modal
          isOpen={Boolean(listToRename)}
          onClose={() => setListToRename(null)}
          title="명단 이름 변경"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                새 명단 이름
              </label>
              <input
                type="text"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 font-medium"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setListToRename(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg"
              >
                취소
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (renameInput.trim()) {
                    await onRenameList(listToRename.id, renameInput.trim());
                    setListToRename(null);
                  }
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                저장
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 3: Edit School Info Modal */}
      {editingSchool && (
        <Modal
          isOpen={Boolean(editingSchool)}
          onClose={() => setEditingSchool(null)}
          title="학교 정보 수정"
          subtitle={`원본 순번: #${editingSchool.originalSeq} (순번은 고정 유지됩니다)`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveSchoolEdit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">지역</label>
              <input
                type="text"
                value={editingSchool.region}
                onChange={(e) =>
                  setEditingSchool({ ...editingSchool, region: e.target.value })
                }
                className="w-full text-xs border border-slate-300 rounded-lg p-2 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">학교(기관)명</label>
              <input
                type="text"
                value={editingSchool.schoolName}
                onChange={(e) =>
                  setEditingSchool({ ...editingSchool, schoolName: e.target.value })
                }
                className="w-full text-xs border border-slate-300 rounded-lg p-2 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                문서24 등록 기관명 (확정 명칭)
              </label>
              <input
                type="text"
                value={editingSchool.doc24OrgName || ''}
                onChange={(e) =>
                  setEditingSchool({ ...editingSchool, doc24OrgName: e.target.value })
                }
                placeholder="문서24 시스템에 등록된 공식 수신처 이름"
                className="w-full text-xs border border-slate-300 rounded-lg p-2 font-medium"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                비워둘 경우 문서24 검색 시 엑셀 학교명으로 조회합니다.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">메모</label>
              <textarea
                value={editingSchool.memo || ''}
                onChange={(e) =>
                  setEditingSchool({ ...editingSchool, memo: e.target.value })
                }
                rows={2}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 font-medium"
                placeholder="특이사항 또는 수신처 참고사항"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingSchool(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                수정 완료
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 4: Add New School Modal */}
      {isAddSchoolOpen && (
        <Modal
          isOpen={isAddSchoolOpen}
          onClose={() => setIsAddSchoolOpen(false)}
          title="새 학교 추가"
          subtitle={`명단: ${activeList?.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveNewSchool} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">지역</label>
              <input
                type="text"
                value={newSchoolForm.region}
                onChange={(e) => setNewSchoolForm({ ...newSchoolForm, region: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 font-medium"
                placeholder="예: 서울특별시, 경기도, 부산광역시"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                학교(기관)명
              </label>
              <input
                type="text"
                value={newSchoolForm.schoolName}
                onChange={(e) =>
                  setNewSchoolForm({ ...newSchoolForm, schoolName: e.target.value })
                }
                placeholder="예: 서울가양초등학교"
                className="w-full text-xs border border-slate-300 rounded-lg p-2 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                문서24 등록 기관명 (선택)
              </label>
              <input
                type="text"
                value={newSchoolForm.doc24OrgName}
                onChange={(e) =>
                  setNewSchoolForm({ ...newSchoolForm, doc24OrgName: e.target.value })
                }
                placeholder="공식 등록 명칭이 다를 경우 입력"
                className="w-full text-xs border border-slate-300 rounded-lg p-2 font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddSchoolOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                추가하기
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* CONFIRMATION: Delete List */}
      {listToDelete && (
        <ConfirmModal
          isOpen={Boolean(listToDelete)}
          onClose={() => setListToDelete(null)}
          onConfirm={() => onDeleteList(listToDelete.id)}
          title="명단 삭제 확인"
          message={`'${listToDelete.name}' 명단과 포함된 ${listToDelete.totalCount}개의 모든 학교 및 발송 기록이 영구히 삭제됩니다.\n계속 진행하시겠습니까?`}
          confirmLabel="명단 영구 삭제"
          isDestructive={true}
        />
      )}

      {/* CONFIRMATION: Delete Single School */}
      {schoolToDelete && (
        <ConfirmModal
          isOpen={Boolean(schoolToDelete)}
          onClose={() => setSchoolToDelete(null)}
          onConfirm={() => onDeleteSchool(schoolToDelete.id)}
          title="학교 삭제 확인"
          message={`순번 #${schoolToDelete.originalSeq} [${schoolToDelete.region}] ${schoolToDelete.schoolName} 학교를 목록에서 삭제하시겠습니까?`}
          confirmLabel="학교 삭제"
          isDestructive={true}
        />
      )}
    </div>
  );
};
