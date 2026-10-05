// 보상 계산 (보상_명세.md). 경험치와 데나리온에 같은 값을 더합니다.
// 서버에서만 부릅니다. 클라이언트가 보낸 보상 값은 쓰지 않습니다.

// 문항당 점수: 단어·문법 1, 문장 3(해석+파싱), 암기 1
export const ITEM_WEIGHT = { word: 1, gram: 1, sent: 3, review: 1, ox: 1, note: 1 };
const BASE = 10;
const ACCURACY_BONUS = 10;
const ACCURACY_LINE = 90; // 한 번에 맞힌 비율(%)
const REVIEW_BONUS_EACH = 2;

// B. 반복 감소: 그날 같은 학습 2회차 ×0.75, 3회차부터 ×0.5
export function repeatMultiplier(sessionNo) {
  if (sessionNo <= 1) return 1;
  if (sessionNo === 2) return 0.75;
  return 0.5;
}

/**
 * @param mode        word | gram | sent | review | ox | note
 * @param itemCount   서로 다른 문항 수 (단어는 단어 수 × 2라운드). 다시 푼 것은 세지 않음
 * @param firstTry    한 번에 맞힌 문항 수
 * @param sessionNo   오늘 같은 mode로 끝낸 수 + 1
 * @param reviewHits  전에 틀렸던 문항(wrong_notes)을 이번에 한 번에 맞힌 수
 */
export function computeReward({ mode, itemCount, firstTry, sessionNo = 1, reviewHits = 0 }) {
  const accuracy = itemCount ? Math.round((firstTry / itemCount) * 100) : 0;
  const bonus = accuracy >= ACCURACY_LINE ? ACCURACY_BONUS : 0;
  const base = BASE + itemCount * (ITEM_WEIGHT[mode] ?? 1) + bonus;
  const multiplier = repeatMultiplier(sessionNo);
  const afterRepeat = multiplier === 1 ? base : Math.max(1, Math.round(base * multiplier));
  const reviewBonus = reviewHits * REVIEW_BONUS_EACH; // C는 B의 감소를 받지 않음
  return { total: afterRepeat + reviewBonus, base, bonus, accuracy, multiplier, reviewBonus, sessionNo };
}

// 결과 카드용 "+N (반복 ×0.75 · 복습 +6)"
export function rewardLabel(r) {
  if (!r) return '';
  const extra = [];
  if (r.multiplier !== 1) extra.push('반복 ×' + r.multiplier);
  if (r.reviewBonus) extra.push('복습 +' + r.reviewBonus);
  return '+' + r.total + (extra.length ? ' (' + extra.join(' · ') + ')' : '');
}
