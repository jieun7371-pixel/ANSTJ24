import React, { useState, useRef } from 'react';
import { AppSettings, SchoolList } from '../../types';
import { exportFullBackup, importFullBackup, clearAllData } from '../../services/db';
import { downloadAutomationPackageZip } from '../../services/agentDownloader';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  Settings as SettingsIcon,
  Shield,
  Download,
  Upload,
  Trash2,
  Check,
  AlertTriangle,
  FileCode,
  HardDrive,
  Cpu,
  Save,
} from 'lucide-react';

interface SettingsViewProps {
  settings: AppSettings;
  lists: SchoolList[];
  onSaveSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  onReloadAllData: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  lists,
  onSaveSettings,
  onReloadAllData,
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  // Backup & Restore
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreMessage, setRestoreMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  // Handle Form Change
  const handleChange = (key: keyof AppSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings(formData);
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2500);
  };

  // Export Backup File
  const handleExportBackup = async () => {
    try {
      const jsonStr = await exportFullBackup();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `문서24_백업_${today}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`백업 생성 실패: ${err.message}`);
    }
  };

  // Import Backup File
  const handleFileRestore = async (file: File) => {
    try {
      const text = await file.text();
      const res = await importFullBackup(text);
      if (res.success) {
        setRestoreMessage({
          text: `백업 복원이 완료되었습니다. (명단 ${res.listCount}개, 학교 ${res.schoolCount}개 복원됨)`,
          isError: false,
        });
        await onReloadAllData();
      } else {
        setRestoreMessage({
          text: res.error || '백업 복원에 실패했습니다.',
          isError: true,
        });
      }
    } catch (err: any) {
      setRestoreMessage({
        text: `파일 복원 실패: ${err.message}`,
        isError: true,
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Clear all data
  const handleClearAll = async () => {
    await clearAllData();
    await onReloadAllData();
    alert('모든 데이터가 초기화되었습니다.');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">시스템 설정</h1>
        <p className="text-xs text-slate-500 mt-1">
          기본 일일 발송 수량, 대기 시간, 로컬 데이터 백업 및 복원 관리
        </p>
      </div>

      {isSavedNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          설정이 성공적으로 저장되었습니다.
        </div>
      )}

      {restoreMessage && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 border ${
            restoreMessage.isError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {restoreMessage.isError ? (
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          ) : (
            <Check className="w-4 h-4 text-blue-600" />
          )}
          <span>{restoreMessage.text}</span>
          <button
            onClick={() => setRestoreMessage(null)}
            className="ml-auto text-[11px] underline"
          >
            닫기
          </button>
        </div>
      )}

      {/* 1. General Batch Settings Form */}
      <form onSubmit={handleSave} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
          <SettingsIcon className="w-4 h-4 text-blue-600" />
          발송 및 배치 운영 기준
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              기본 하루 발송 수량 (개)
            </label>
            <input
              type="number"
              min={10}
              max={200}
              value={formData.dailyQuota}
              onChange={(e) => handleChange('dailyQuota', Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg p-2 font-medium"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              문서24 표준 권장값: 50개 (1일차 1~50, 2일차 51~100)
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              발송 간 기본 대기 시간 (초)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={formData.defaultDelaySec}
              onChange={(e) => handleChange('defaultDelaySec', Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg p-2 font-medium"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              연속 발송 시 시스템 부하 방지용 지연 대기 시간 (권장: 3~5초)
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              테스트 모드 기본 활성화
            </label>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="testModeCheck"
                checked={formData.testModeDefault}
                onChange={(e) => handleChange('testModeDefault', e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-slate-300"
              />
              <label htmlFor="testModeCheck" className="text-xs text-slate-700 cursor-pointer">
                실제 발송 전 모의 테스트 모드를 기본값으로 유지
              </label>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              기관 자동 선택 (1건 정확 일치 시)
            </label>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="autoSelectCheck"
                checked={formData.autoSelectExactMatch}
                onChange={(e) => handleChange('autoSelectExactMatch', e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-slate-300"
              />
              <label htmlFor="autoSelectCheck" className="text-xs text-slate-700 cursor-pointer">
                검색 결과가 정확히 1건일 경우 자동으로 확정 기관명 등록
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            설정 저장
          </button>
        </div>
      </form>

      {/* 2. Data Backup & Restore */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-blue-600" />
          데이터 백업 및 복원 (IndexedDB)
        </h3>

        <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <Shield className="w-4 h-4 text-emerald-600" />
            100% 브라우저 독립 보관 원칙
          </div>
          <p className="leading-relaxed">
            모든 학교 명단, 순번, 사전점검 및 발송 이력은 이용자 PC 브라우저 내부의 <strong>IndexedDB</strong>에만 저장됩니다.
            외부 서버로 개인정보나 학교 정보가 전혀 전송되지 않습니다.
            PC를 교체하거나 브라우저 캐시를 청소하기 전 <strong>[데이터 백업 파일 다운로드]</strong>를 통해 JSON 파일로 보관해 두세요.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Backup */}
          <div className="border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 block mb-1">
                전체 데이터 백업
              </span>
              <p className="text-[11px] text-slate-500 mb-3">
                현재 등록된 모든 명단, 학교 목록, 발송 결과 및 설정을 1개의 JSON 백업 파일로 저장합니다.
              </p>
            </div>
            <button
              onClick={handleExportBackup}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              백업 파일 다운로드 (.json)
            </button>
          </div>

          {/* Restore */}
          <div className="border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 block mb-1">
                백업 데이터 복원
              </span>
              <p className="text-[11px] text-slate-500 mb-3">
                기존에 저장해 둔 JSON 백업 파일을 업로드하여 명단과 진행 기록을 그대로 복원합니다.
              </p>
            </div>
            <div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileRestore(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                백업 파일 불러오기 (.json)
              </button>
            </div>
          </div>
        </div>

        {/* Clear All Data */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">데이터를 완전히 비우고 처음 상태로 되돌립니다.</span>
          <button
            onClick={() => setIsClearConfirmOpen(true)}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            전체 데이터 초기화
          </button>
        </div>
      </div>

      {/* 3. Local Python Program Agent Download & API Specification */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                로컬 자동화 프로그램 설치 및 다운로드
              </h3>
              <p className="text-[11px] text-slate-500">
                Windows, macOS, Linux 지원 · Python 내장 모듈 사용 (추가 pip 설치 불필요)
              </p>
            </div>
          </div>

          <button
            onClick={downloadAutomationPackageZip}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            로컬 프로그램 설치팩 다운로드 (.zip)
          </button>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 space-y-1.5">
          <span className="font-bold text-slate-900 block">원클릭 실행 방법</span>
          <ol className="list-decimal list-inside space-y-1 text-slate-600">
            <li>다운로드한 <strong>[문서24_로컬자동화_설치팩.zip]</strong>의 압축을 풉니다.</li>
            <li>Windows 사용자는 <strong>run.bat</strong> 파일을 더블 클릭하여 실행합니다. (바탕화면 바로가기는 <strong>install.bat</strong>)</li>
            <li>macOS / Linux 사용자는 터미널에서 <code>bash run.sh</code>를 실행합니다.</li>
            <li>콘솔 창이 열려있는 상태에서 본 웹사이트 상단의 <strong>[Chrome 실행]</strong>을 누르면 자동화 전용 Chrome 브라우저가 실행됩니다.</li>
          </ol>
        </div>

        <div className="pt-2">
          <h4 className="text-xs font-bold text-slate-800 mb-2">로컬 에이전트 REST API 규격 (포트 24000)</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-2 bg-slate-50 rounded border border-slate-200">
              <span className="text-blue-700 font-bold">GET</span> /api/status - 연결/크롬/로그인 상태 조회
            </div>
            <div className="p-2 bg-slate-50 rounded border border-slate-200">
              <span className="text-blue-700 font-bold">GET</span> /api/lists - 로컬 명단 목록 조회
            </div>
            <div className="p-2 bg-slate-50 rounded border border-slate-200">
              <span className="text-emerald-700 font-bold">POST</span> /api/upload - 명단 전달
            </div>
            <div className="p-2 bg-slate-50 rounded border border-slate-200">
              <span className="text-emerald-700 font-bold">POST</span> /api/precheck - 사전 점검 자동화 수행
            </div>
            <div className="p-2 bg-slate-50 rounded border border-slate-200">
              <span className="text-blue-700 font-bold">GET</span> /api/batch/today - 오늘 배치 조회
            </div>
            <div className="p-2 bg-slate-50 rounded border border-slate-200">
              <span className="text-emerald-700 font-bold">POST</span> /api/send/start - 발송 시작
            </div>
            <div className="p-2 bg-slate-50 rounded border border-slate-200">
              <span className="text-emerald-700 font-bold">POST</span> /api/send/pause - 발송 일시정지
            </div>
            <div className="p-2 bg-slate-50 rounded border border-slate-200">
              <span className="text-emerald-700 font-bold">POST</span> /api/send/stop - 발송 즉시 중단
            </div>
          </div>
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {isClearConfirmOpen && (
        <ConfirmModal
          isOpen={isClearConfirmOpen}
          onClose={() => setIsClearConfirmOpen(false)}
          onConfirm={handleClearAll}
          title="전체 데이터 초기화"
          message="모든 학교 명단과 발송 이력, 설정이 브라우저에서 영구 삭제됩니다.\n사전에 백업 파일을 다운로드하셨는지 확인해 주세요."
          confirmLabel="모든 데이터 초기화"
          isDestructive={true}
        />
      )}
    </div>
  );
};
