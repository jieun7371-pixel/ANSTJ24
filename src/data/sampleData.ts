import { SchoolItem, SchoolList } from '../types';

export const SAMPLE_LIST_ID = 'sample_list_schools_2026';

export const SAMPLE_LIST_META: SchoolList = {
  id: SAMPLE_LIST_ID,
  name: '전국 초·중·고교 표준 발송 명단 (샘플 데이터)',
  createdAt: '2026-11-01T09:00:00.000Z',
  updatedAt: new Date().toISOString(),
  totalCount: 75,
  sourceFileName: '전국_초중고_표준명단_샘플.xlsx',
  sourceSheetName: '1_전국학교명단',
  columnMapping: {
    schoolNameCol: '학교명',
    regionCol: '지역',
  },
};

const RAW_SAMPLE_ITEMS: Array<{
  seq: number;
  region: string;
  name: string;
  doc24Org?: string;
  matchedOrg?: string;
  matchedDetail?: string;
  candidateCount?: number;
  precheck: SchoolItem['precheckStatus'];
  dispatch: SchoolItem['dispatchStatus'];
  memo?: string;
  dispatchedAt?: string;
}> = [
  // 1 ~ 15: Batch 1 items
  { seq: 1, region: '서울특별시', name: '서울종로초등학교', doc24Org: '서울종로초등학교', matchedOrg: '서울종로초등학교', matchedDetail: '서울 종로구 율곡로', candidateCount: 1, precheck: 'exact_1', dispatch: 'success', dispatchedAt: '2026-11-06 10:14:22', memo: '정상 접수 확인' },
  { seq: 2, region: '서울특별시', name: '서울중앙중학교', doc24Org: '서울중앙중학교', matchedOrg: '서울중앙중학교', matchedDetail: '서울 종로구 계동', candidateCount: 1, precheck: 'exact_1', dispatch: 'success', dispatchedAt: '2026-11-06 10:15:03' },
  { seq: 3, region: '서울특별시', name: '경복고등학교', doc24Org: '경복고등학교', matchedOrg: '경복고등학교', matchedDetail: '서울 종로구 자하문로', candidateCount: 1, precheck: 'exact_1', dispatch: 'success', dispatchedAt: '2026-11-06 10:15:45' },
  { seq: 4, region: '부산광역시', name: '부산해운대초등학교', doc24Org: '부산해운대초등학교', matchedOrg: '부산해운대초등학교', matchedDetail: '부산 해운대구 중동', candidateCount: 1, precheck: 'exact_1', dispatch: 'success', dispatchedAt: '2026-11-06 10:16:10' },
  { seq: 5, region: '부산광역시', name: '부산중앙중학교', doc24Org: '부산중앙중학교', matchedOrg: '부산중앙중학교', matchedDetail: '부산 동구 초량동', candidateCount: 1, precheck: 'exact_1', dispatch: 'success', dispatchedAt: '2026-11-06 10:16:50', memo: '동명학교(서울중앙중)와 지역 구분 완료' },
  { seq: 6, region: '대구광역시', name: '대구수성초등학교', doc24Org: '', matchedOrg: '대구수성초등학교병설유치원 외 1건', matchedDetail: '대구 수성구', candidateCount: 2, precheck: 'multiple_matches', dispatch: 'needs_review', memo: '병설유치원과 초등학교 후보 분리 확인 필요' },
  { seq: 7, region: '대구광역시', name: '대구계성중학교', doc24Org: '대구계성중학교', matchedOrg: '대구계성중학교', matchedDetail: '대구 서구 달성로', candidateCount: 1, precheck: 'exact_1', dispatch: 'success', dispatchedAt: '2026-11-06 10:18:00' },
  { seq: 8, region: '인천광역시', name: '인천송도초등학교', doc24Org: '인천송도초등학교', matchedOrg: '인천송도초등학교', matchedDetail: '인천 연수구 한나루로', candidateCount: 1, precheck: 'exact_1', dispatch: 'success', dispatchedAt: '2026-11-06 10:18:42' },
  { seq: 9, region: '인천광역시', name: '인천하늘고등학교', doc24Org: '인천하늘고등학교', matchedOrg: '인천하늘고등학교', matchedDetail: '인천 중구 영종순환로', candidateCount: 1, precheck: 'exact_1', dispatch: 'success', dispatchedAt: '2026-11-06 10:19:15' },
  { seq: 10, region: '광주광역시', name: '광주상무초등학교', doc24Org: '광주상무초등학교', matchedOrg: '광주상무초등학교', matchedDetail: '광주 서구 상무평화로', candidateCount: 1, precheck: 'exact_1', dispatch: 'failed', memo: '문서24 접수처 일시적 응답 지연 (수신처 오류)' },
  { seq: 11, region: '대전광역시', name: '대전둔산초등학교', doc24Org: '대전둔산초등학교', matchedOrg: '대전둔산초등학교', matchedDetail: '대전 서구 둔산로', candidateCount: 1, precheck: 'exact_1', dispatch: 'success', dispatchedAt: '2026-11-06 10:20:30' },
  { seq: 12, region: '대전광역시', name: '대전과학고등학교', doc24Org: '대전과학고등학교', matchedOrg: '대전과학고등학교', matchedDetail: '대전 유성구 대덕대로', candidateCount: 1, precheck: 'exact_1', dispatch: 'success', dispatchedAt: '2026-11-06 10:21:05' },
  { seq: 13, region: '울산광역시', name: '울산옥동초등학교', doc24Org: '울산옥동초등학교', matchedOrg: '울산옥동초등학교', matchedDetail: '울산 남구 문수로', candidateCount: 1, precheck: 'exact_1', dispatch: 'success', dispatchedAt: '2026-11-06 10:21:40' },
  { seq: 14, region: '세종특별자치시', name: '세종보람초등학교', doc24Org: '세종보람초등학교', matchedOrg: '세종보람초등학교', matchedDetail: '세종특별자치시 보람동', candidateCount: 1, precheck: 'exact_1', dispatch: 'success', dispatchedAt: '2026-11-06 10:22:15' },
  { seq: 15, region: '세종특별자치시', name: '세종새롬고등학교', doc24Org: '세종새롬고등학교', matchedOrg: '세종새롬고등학교', matchedDetail: '세종특별자치시 새롬동', candidateCount: 1, precheck: 'exact_1', dispatch: 'success', dispatchedAt: '2026-11-06 10:23:00' },

  // 16 ~ 50: Still in Day 1 Batch
  { seq: 16, region: '경기도', name: '수원매탄초등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 17, region: '경기도', name: '성남수내중학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 18, region: '경기도', name: '안양신성고등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 19, region: '경기도', name: '용인수지고등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 20, region: '경기도', name: '고양일산동초등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 21, region: '강원특별자치도', name: '춘천남부초등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 22, region: '강원특별자치도', name: '원주단구중학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 23, region: '강원특별자치도', name: '강릉명륜고등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 24, region: '충청북도', name: '청주상당초등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 25, region: '충청북도', name: '충주예성여자고등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 26, region: '충청남도', name: '천안불당초등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 27, region: '충청남도', name: '아산용화중학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 28, region: '충청남도', name: '공주사대부설고등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 29, region: '전북특별자치도', name: '전주완산초등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 30, region: '전북특별자치도', name: '군산진포중학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 31, region: '전북특별자치도', name: '익산남성고등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 32, region: '전라남도', name: '목포유달초등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 33, region: '전라남도', name: '여수웅천중학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 34, region: '전라남도', name: '순천매산고등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 35, region: '경상북도', name: '포항제철초등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 36, region: '경상북도', name: '구미옥계중학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 37, region: '경상북도', name: '경주화랑고등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 38, region: '경상남도', name: '창원의창초등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 39, region: '경상남도', name: '김해율하고등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 40, region: '경상남도', name: '진주동명중학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 41, region: '제주특별자치도', name: '제주노형초등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 42, region: '제주특별자치도', name: '서귀포서귀중학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 43, region: '제주특별자치도', name: '제주제일고등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 44, region: '서울특별시', name: '서울방배초등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 45, region: '서울특별시', name: '서울대치중학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 46, region: '서울특별시', name: '단국대학교사범대학부속고등학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 47, region: '부산광역시', name: '부산남천초등학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 48, region: '부산광역시', name: '부산대연중학교', precheck: 'exact_1', dispatch: 'waiting' },
  { seq: 49, region: '대구광역시', name: '대구동도초등학교', precheck: 'not_found', dispatch: 'needs_review', memo: '문서24 기관 검색 결과 없음 (폐교 또는 명칭 변경 확인 요망)' },
  { seq: 50, region: '인천광역시', name: '인천연수중학교', precheck: 'exact_1', dispatch: 'waiting' },

  // 51 ~ 75: Batch 2 items (Day 2 batch: 51~100 range)
  { seq: 51, region: '광주광역시', name: '광주봉선초등학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 52, region: '광주광역시', name: '광주수완중학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 53, region: '대전광역시', name: '대전어은초등학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 54, region: '대전광역시', name: '대전노은중학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 55, region: '울산광역시', name: '울산남산초등학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 56, region: '울산광역시', name: '울산신정고등학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 57, region: '세종특별자치시', name: '세종한솔초등학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 58, region: '세종특별자치시', name: '세종도담중학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 59, region: '경기도', name: '부천상동초등학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 60, region: '경기도', name: '화성동탄중학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 61, region: '경기도', name: '남양주다산고등학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 62, region: '강원특별자치도', name: '속초청봉초등학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 63, region: '강원특별자치도', name: '동해북삼초등학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 64, region: '충청북도', name: '제천중학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 65, region: '충청북도', name: '진천고등학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 66, region: '충청남도', name: '서산서령중학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 67, region: '충청남도', name: '당진호서고등학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 68, region: '전북특별자치도', name: '정읍호남중학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 69, region: '전라남도', name: '나주금성고등학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 70, region: '경상북도', name: '안동경안중학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 71, region: '경상남도', name: '통영동원고등학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 72, region: '경상남도', name: '거제옥포중학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 73, region: '제주특별자치도', name: '제주아라중학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 74, region: '제주특별자치도', name: '제주오현고등학교', precheck: 'not_checked', dispatch: 'waiting' },
  { seq: 75, region: '서울특별시', name: '서울잠실초등학교', precheck: 'not_checked', dispatch: 'waiting' },
];

export function getSampleSchools(listId: string = SAMPLE_LIST_ID): SchoolItem[] {
  return RAW_SAMPLE_ITEMS.map((raw) => {
    // Check duplicate name
    const duplicates = RAW_SAMPLE_ITEMS.filter((i) => i.name === raw.name);
    const hasDuplicateName = duplicates.length > 1;
    const isDuplicateDifferentRegion =
      hasDuplicateName && new Set(duplicates.map((d) => d.region)).size > 1;

    return {
      id: `${listId}_sample_${raw.seq}`,
      listId,
      originalSeq: raw.seq,
      region: raw.region,
      schoolName: raw.name,
      doc24OrgName: raw.doc24Org || (raw.precheck === 'exact_1' ? raw.name : ''),
      matchedOrgName: raw.matchedOrg || (raw.precheck === 'exact_1' ? raw.name : ''),
      matchedOrgDetail: raw.matchedDetail || '',
      candidateCount: raw.candidateCount ?? (raw.precheck === 'exact_1' ? 1 : 0),
      precheckStatus: raw.precheck,
      dispatchStatus: raw.dispatch,
      dispatchedAt: raw.dispatchedAt,
      batchNumber: Math.ceil(raw.seq / 50),
      memo: raw.memo || '',
      hasDuplicateName,
      isDuplicateDifferentRegion,
      createdAt: '2026-11-01T09:00:00.000Z',
      updatedAt: new Date().toISOString(),
    };
  });
}
