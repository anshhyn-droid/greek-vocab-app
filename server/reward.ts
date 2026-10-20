// 보상(경험치 = 데나리온). 서버에서만 계산하고 화면이 보낸 값은 쓰지 않음
// 완료 10 + 문항 수 × 무게(단어·문법 1, 문장 3) + 한 번에 맞힌 비율 90% 이상이면 10
// B. 반복 감소: 그날 같은 학습 2회차 ×0.75, 3회차부터 ×0.5 / C. 복습: 전에 틀린 문항을 한 번에 맞히면 하나에 +2 (감소 없음)
const WEIGHT: Record<string, number> = { word: 1, gram: 1, sent: 3, mix: 1, flash: 1 };

export interface Reward { total: number; base: number; bonus: number; accuracy: number; multiplier: number; reviewBonus: number }

export function computeReward(type: string, itemCount: number, firstTry: number, sessionNo: number, reviewHits: number): Reward {
  const accuracy = itemCount ? Math.round((firstTry / itemCount) * 100) : 0;
  const bonus = accuracy >= 90 ? 10 : 0;
  const base = 10 + itemCount * (WEIGHT[type] ?? 1) + bonus;
  const multiplier = sessionNo <= 1 ? 1 : sessionNo === 2 ? 0.75 : 0.5;
  const after = multiplier === 1 ? base : Math.max(1, Math.round(base * multiplier));
  const reviewBonus = reviewHits * 2;
  return { total: after + reviewBonus, base, bonus, accuracy, multiplier, reviewBonus };
}
