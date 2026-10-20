// 오늘의 목표 수정 팝업: 종류별 목표 ±. "매일 0시에 새로 시작" 안내는 여기에만 (공통 규칙)
import { BlocksIcon, BookA, ListChecks, Minus, Plus } from 'lucide-react';
import Dialog from './ui/Dialog';
import { KINDS, type Kind } from '../lib/home';
import styles from './GoalDialog.module.css';

const ICON = { word: BookA, gram: ListChecks, sent: BlocksIcon };

export default function GoalDialog({ goal, onStep, onClose }: { goal: Record<Kind, number>; onStep: (k: Kind, d: number) => void; onClose: () => void }) {
  const sum = goal.word + goal.gram + goal.sent;
  const step = onStep;
  return (
    <Dialog onClose={onClose} style={{ gap: 14, padding: '24px 22px 20px' }}>
      <div className={styles.head}>
        <span className={styles.title}>오늘의 목표</span>
        <span className={styles.sum}>합계 {sum}문항</span>
      </div>
      <div className={styles.rows}>
        {KINDS.map(({ k, label }) => {
          const Icon = ICON[k];
          return (
            <div key={k} className={styles.row}>
              <Icon size={15} strokeWidth={2.75} color="var(--muted)" />
              <span className={styles.label}>{label}</span>
              <button onClick={() => step(k, -1)} title="줄이기" className={styles.pm} style={{ opacity: goal[k] > 0 ? 1 : 0.4 }}><Minus size={15} strokeWidth={2.75} /></button>
              <span className={styles.v}>{goal[k]}</span>
              <button onClick={() => step(k, 1)} title="늘리기" className={styles.pm}><Plus size={15} strokeWidth={2.75} /></button>
            </div>
          );
        })}
      </div>
      <span className={styles.note}>매일 0시에 0부터 새로 시작합니다.</span>
      <button onClick={onClose} className={styles.ok}>완료</button>
    </Dialog>
  );
}
