// 책 안의 두 쪽. 컴퓨터: 왼쪽·오른쪽 쪽(비율 split%) + 가운데 접힌 곳 / 폰: 왼쪽 → 오른쪽 순서로 위아래
import type { CSSProperties, ReactNode } from 'react';
import { paperGradient, useBookSize } from '../../lib/viewport';
import styles from './BookPages.module.css';

interface Props {
  left: ReactNode;
  right: ReactNode;
  split?: number; // 왼쪽 쪽 비율(%). 기본 50
  leftPad?: string; // 쪽 안쪽 여백. 접힌 곳 쪽을 넉넉히
  rightPad?: string;
  phoneGap?: number;
}

export default function BookPages({ left, right, split = 50, leftPad = '34px 56px 30px 36px', rightPad = '34px 40px 30px 60px', phoneGap = 20 }: Props) {
  const { narrow } = useBookSize();
  if (narrow) {
    return (
      <div className={styles.phone} style={{ gap: phoneGap }}>
        <div className={styles.phonePage}>{left}</div>
        <div className={styles.phonePage}>{right}</div>
      </div>
    );
  }
  const vars = { gridTemplateColumns: `minmax(0,${split}fr) minmax(0,${100 - split}fr)`, background: paperGradient(split) } as CSSProperties;
  return (
    <div className={styles.spread} style={vars}>
      <div className={styles.fold} style={{ left: split + '%' }} aria-hidden="true" />
      <div className={`${styles.page} scroll-hidden`} style={{ padding: leftPad }}>{left}</div>
      <div className={`${styles.page} scroll-hidden`} style={{ padding: rightPad }}>{right}</div>
    </div>
  );
}
