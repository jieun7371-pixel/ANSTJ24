import React from 'react';
import { ActiveTab, SchoolList } from '../../types';
import {
  LayoutDashboard,
  FileSpreadsheet,
  CheckSquare2,
  CalendarDays,
  Send,
  ClipboardCheck,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  School,
  FileText,
} from 'lucide-react';

interface SidebarProps {
  currentTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeList: SchoolList | null;
  totalListsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
  activeList,
  totalListsCount,
}) => {
  const menuItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ElementType;
    description: string;
  }> = [
    { id: 'dashboard', label: '대시보드', icon: LayoutDashboard, description: '전체 현황 및 오늘 배치' },
    { id: 'lists', label: '학교 명단 관리', icon: FileSpreadsheet, description: '엑셀 업로드 및 명단 편집' },
    { id: 'precheck', label: '사전 점검', icon: CheckSquare2, description: '문서24 기관명 일치 확인' },
    { id: 'batch', label: '일일 발송 관리', icon: CalendarDays, description: '하루 50개 배치 관리' },
    { id: 'execution', label: '발송 실행', icon: Send, description: '로컬 연동 발송 제어' },
    { id: 'results', label: '발송 결과', icon: ClipboardCheck, description: '결과 조회 및 엑셀 다운' },
    { id: 'settings', label: '설정', icon: Settings, description: '발송 기준 및 백업/복원' },
    { id: 'guide', label: '사용 안내', icon: HelpCircle, description: '업무 가이드 및 FAQ' },
  ];

  return (
    <aside
      className={`fixed top-0 bottom-0 left-0 z-30 flex flex-col bg-slate-900 text-slate-200 transition-all duration-200 ease-in-out border-r border-slate-800 ${
        collapsed ? 'w-18' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white shrink-0 font-bold shadow-md shadow-blue-900/40">
            <FileText className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col truncate">
              <span className="text-sm font-bold text-white tracking-tight truncate">
                문서24 공문 관리
              </span>
              <span className="text-[11px] text-slate-400 truncate">
                일괄 발송 업무 포털
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Active List Quick Info Banner */}
      {!collapsed && (
        <div className="p-3 mx-3 my-3 bg-slate-800/80 rounded-lg border border-slate-700/60">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1">
              <School className="w-3.5 h-3.5 text-blue-400" />
              선택된 명단
            </span>
            <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono">
              총 {totalListsCount}개
            </span>
          </div>
          <div
            className="text-xs font-medium text-white truncate cursor-pointer hover:text-blue-300"
            title={activeList ? activeList.name : '선택된 명단 없음'}
            onClick={() => onTabChange('lists')}
          >
            {activeList ? activeList.name : '등록된 명단이 없습니다'}
          </div>
          {activeList && (
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>학교 수</span>
              <span className="font-mono text-blue-300 font-semibold">{activeList.totalCount.toLocaleString()}개</span>
            </div>
          )}
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="flex-1 px-2.5 py-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left group relative ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-transform ${
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              {!collapsed && (
                <div className="flex flex-col truncate">
                  <span className="truncate">{item.label}</span>
                  <span
                    className={`text-[10px] truncate ${
                      isActive ? 'text-blue-100' : 'text-slate-500 group-hover:text-slate-400'
                    }`}
                  >
                    {item.description}
                  </span>
                </div>
              )}
              {/* Active line indicator for collapsed mode */}
              {collapsed && isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer info */}
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500">
        {!collapsed ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-slate-400">
              <span>데이터 보존</span>
              <span className="text-emerald-400 font-medium">로컬 IndexedDB</span>
            </div>
            <div className="text-[10px] text-slate-500">
              외부 서버 전송 없음 · 100% 안전
            </div>
          </div>
        ) : (
          <div className="text-center text-[10px] text-slate-600">IDB</div>
        )}
      </div>
    </aside>
  );
};
