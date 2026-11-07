import * as XLSX from 'xlsx';
import { DispatchStatus, PrecheckStatus, SchoolItem } from '../types';

export interface ParsedSheetData {
  fileName: string;
  sheetNames: string[];
  sheets: { [sheetName: string]: any[][] };
}

export interface ColumnSuggestion {
  schoolColIdx: number;
  regionColIdx: number;
  headers: string[];
}

export const PRECHECK_STATUS_LABELS: Record<PrecheckStatus, string> = {
  not_checked: '점검 전',
  exact_1: '정확히 1건 일치',
  not_found: '검색 결과 없음',
  multiple_matches: '동일 이름 여러 건',
  region_needed: '지역 구분 필요',
  name_mismatch: '이름 불일치',
  search_error: '검색 오류',
  needs_review: '확인필요',
};

export const DISPATCH_STATUS_LABELS: Record<DispatchStatus, string> = {
  waiting: '대기',
  sending: '발송 중',
  success: '성공 확인',
  failed: '실패 확인',
  needs_review: '확인필요',
};

/**
 * Reads an Excel (.xlsx, .xls) or CSV file and extracts all sheets as 2D arrays
 */
export async function readExcelFile(file: File): Promise<ParsedSheetData> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const sheets: { [sheetName: string]: any[][] } = {};
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // Convert to 2D array, preserving empty cells as empty string
    const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      blankrows: true,
    });
    sheets[sheetName] = rawData;
  }

  return {
    fileName: file.name,
    sheetNames: workbook.SheetNames,
    sheets,
  };
}

/**
 * Analyzes the top rows of a sheet to detect headers and recommend columns
 */
export function analyzeColumns(rows: any[][]): ColumnSuggestion {
  if (!rows || rows.length === 0) {
    return { schoolColIdx: -1, regionColIdx: -1, headers: [] };
  }

  // Find header row (first row with at least one non-empty string)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    if (row && row.some((cell) => typeof cell === 'string' && cell.trim().length > 0)) {
      headerRowIdx = i;
      break;
    }
  }

  const rawHeaders = rows[headerRowIdx] || [];
  const headers = rawHeaders.map((h, idx) => (h ? String(h).trim() : `열 ${idx + 1}`));

  let schoolColIdx = -1;
  let regionColIdx = -1;

  // Pattern matching for school name
  const schoolRegex = /학교명|초등학교|중학교|고등학교|기관명|기관|학교|수신처|수신기관|시설명|기관\/학교|이름/i;
  // Pattern matching for region
  const regionRegex = /지역|시도|시군구|교육청|관할|소속|위치|도\/시/i;

  headers.forEach((header, idx) => {
    if (schoolColIdx === -1 && schoolRegex.test(header)) {
      schoolColIdx = idx;
    }
    if (regionColIdx === -1 && regionRegex.test(header)) {
      regionColIdx = idx;
    }
  });

  // Fallback: If not found in headers, check first 5 data rows for common keywords
  if (schoolColIdx === -1) {
    for (let c = 0; c < headers.length; c++) {
      for (let r = headerRowIdx + 1; r < Math.min(rows.length, headerRowIdx + 6); r++) {
        const val = String(rows[r]?.[c] || '');
        if (/초등|중학|고등|학교|교육/i.test(val)) {
          schoolColIdx = c;
          break;
        }
      }
      if (schoolColIdx !== -1) break;
    }
  }

  return {
    schoolColIdx,
    regionColIdx,
    headers,
  };
}

/**
 * Converts parsed sheet rows into SchoolItem list maintaining original order
 */
export function processSheetRows(
  rows: any[][],
  startRowIdx: number,
  schoolColIdx: number,
  regionColIdx: number,
  listId: string,
  startOriginalSeq: number = 1
): {
  items: SchoolItem[];
  emptyRowCount: number;
  duplicateCount: number;
  duplicateNames: string[];
} {
  const items: SchoolItem[] = [];
  let emptyRowCount = 0;
  let currentSeq = startOriginalSeq;

  // Track occurrences for duplicate detection
  const schoolOccurrences: { [name: string]: { count: number; regions: Set<string> } } = {};

  for (let i = startRowIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row) {
      emptyRowCount++;
      continue;
    }

    const rawSchool = row[schoolColIdx];
    const rawRegion = regionColIdx >= 0 ? row[regionColIdx] : '';

    const schoolName = rawSchool !== undefined && rawSchool !== null ? String(rawSchool).trim() : '';
    const region = rawRegion !== undefined && rawRegion !== null ? String(rawRegion).trim() : '전국';

    // Skip empty school name row
    if (!schoolName) {
      emptyRowCount++;
      continue;
    }

    if (!schoolOccurrences[schoolName]) {
      schoolOccurrences[schoolName] = { count: 0, regions: new Set() };
    }
    schoolOccurrences[schoolName].count++;
    if (region) {
      schoolOccurrences[schoolName].regions.add(region);
    }

    const item: SchoolItem = {
      id: `${listId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${currentSeq}`,
      listId,
      originalSeq: currentSeq,
      region: region || '미지정',
      schoolName,
      doc24OrgName: '',
      precheckStatus: 'not_checked',
      dispatchStatus: 'waiting',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    items.push(item);
    currentSeq++;
  }

  // Second pass: Mark duplicates and check if different regions
  const duplicateNames: string[] = [];
  items.forEach((item) => {
    const stats = schoolOccurrences[item.schoolName];
    if (stats && stats.count > 1) {
      item.hasDuplicateName = true;
      if (stats.regions.size > 1) {
        item.isDuplicateDifferentRegion = true;
      }
      if (!duplicateNames.includes(item.schoolName)) {
        duplicateNames.push(item.schoolName);
      }
    }
  });

  return {
    items,
    emptyRowCount,
    duplicateCount: duplicateNames.length,
    duplicateNames,
  };
}

/**
 * Downloads a well-formatted sample Excel file (.xlsx)
 */
export function downloadSampleExcel(): void {
  const sampleData = [
    ['지역', '학교명', '비고 (예시 데이터)'],
    ['서울특별시', '서울여의도초등학교', '수도권 샘플'],
    ['서울특별시', '서울반포중학교', '수도권 샘플'],
    ['서울특별시', '서울과학고등학교', '수도권 샘플'],
    ['부산광역시', '부산해운대초등학교', '영남권 샘플'],
    ['부산광역시', '부산센텀중학교', '영남권 샘플'],
    ['부산광역시', '부산국제고등학교', '영남권 샘플'],
    ['대구광역시', '대구수성초등학교', '영남권 샘플'],
    ['대구광역시', '대구범어중학교', '영남권 샘플'],
    ['인천광역시', '인천송도초등학교', '수도권 샘플'],
    ['인천광역시', '인천청라중학교', '수도권 샘플'],
    ['광주광역시', '광주상무초등학교', '호남권 샘플'],
    ['광주광역시', '광주첨단중학교', '호남권 샘플'],
    ['대전광역시', '대전둔산초등학교', '충청권 샘플'],
    ['대전광역시', '대전유성중학교', '충청권 샘플'],
    ['울산광역시', '울산태화초등학교', '영남권 샘플'],
    ['울산광역시', '울산옥동중학교', '영남권 샘플'],
    ['세종특별자치시', '세종아름초등학교', '충청권 샘플'],
    ['세종특별자치시', '세종보람중학교', '충청권 샘플'],
    ['경기도', '수원매탄초등학교', '경기남부 샘플'],
    ['경기도', '성남분당중학교', '경기남부 샘플'],
    ['경기도', '고양일산고등학교', '경기북부 샘플'],
    ['강원특별자치도', '춘천남부초등학교', '강원권 샘플'],
    ['충청북도', '청주상당중학교', '충북 샘플'],
    ['충청남도', '천안불당초등학교', '충남 샘플'],
    ['전북특별자치도', '전주완산초등학교', '전북 샘플'],
    ['전라남도', '목포유달중학교', '전남 샘플'],
    ['경상북도', '포항영일고등학교', '경북 샘플'],
    ['경상남도', '창원의창초등학교', '경남 샘플'],
    ['제주특별자치도', '제주노형초등학교', '제주 샘플'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(sampleData);
  // Set column widths
  ws['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 24 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '학교명단_샘플');

  XLSX.writeFile(wb, '문서24_학교명단_샘플양식.xlsx');
}

/**
 * Exports full school list to Excel
 */
export function exportSchoolsToExcel(schools: SchoolItem[], listName: string): void {
  const headers = [
    '순번',
    '지역',
    '학교(기관)명',
    '문서24 등록 기관명',
    '사전 점검 상태',
    '발송 상태',
    '발송 일시',
    '일일 배치',
    '메모 / 오류 내역',
  ];

  const rows = schools.map((s) => [
    s.originalSeq,
    s.region,
    s.schoolName,
    s.doc24OrgName || s.matchedOrgName || '',
    PRECHECK_STATUS_LABELS[s.precheckStatus] || s.precheckStatus,
    DISPATCH_STATUS_LABELS[s.dispatchStatus] || s.dispatchStatus,
    s.dispatchedAt || '',
    s.batchNumber ? `${s.batchNumber}일차` : '',
    s.memo || '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 8 },
    { wch: 14 },
    { wch: 26 },
    { wch: 26 },
    { wch: 18 },
    { wch: 14 },
    { wch: 20 },
    { wch: 12 },
    { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '학교명단');

  const safeName = listName.replace(/[/\\?%*:|"<>]/g, '_');
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  XLSX.writeFile(wb, `${safeName}_학교명단_${today}.xlsx`);
}

/**
 * Exports pre-check results to Excel
 */
export function exportPrecheckToExcel(schools: SchoolItem[], listName: string): void {
  const headers = [
    '순번',
    '지역',
    '엑셀 학교명',
    '검색된 기관명',
    '상세기관명',
    '후보 개수',
    '점검 결과',
    '비고 / 매핑 기관명',
  ];

  const rows = schools.map((s) => [
    s.originalSeq,
    s.region,
    s.schoolName,
    s.matchedOrgName || '',
    s.matchedOrgDetail || '',
    s.candidateCount ?? (s.precheckStatus === 'exact_1' ? 1 : 0),
    PRECHECK_STATUS_LABELS[s.precheckStatus] || s.precheckStatus,
    s.doc24OrgName || '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 8 },
    { wch: 14 },
    { wch: 26 },
    { wch: 26 },
    { wch: 20 },
    { wch: 10 },
    { wch: 18 },
    { wch: 26 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '사전점검결과');

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  XLSX.writeFile(wb, `사전점검결과_${today}.xlsx`);
}

/**
 * Exports dispatch results to Excel
 * Requirement: 파일명: 결과_YYYYMMDD.xlsx
 */
export function exportResultsToExcel(schools: SchoolItem[]): void {
  const headers = ['순번', '지역', '학교명', '발송 상태', '처리 시각', '메모'];

  const rows = schools.map((s) => [
    s.originalSeq,
    s.region,
    s.schoolName,
    DISPATCH_STATUS_LABELS[s.dispatchStatus] || s.dispatchStatus,
    s.dispatchedAt || '',
    s.memo || '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 8 },
    { wch: 14 },
    { wch: 26 },
    { wch: 14 },
    { wch: 22 },
    { wch: 32 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '발송결과');

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  XLSX.writeFile(wb, `결과_${today}.xlsx`);
}
