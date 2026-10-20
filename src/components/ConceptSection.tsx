// 문법 개념 표 한 묶음 (제목 + 문단·목록·표·주의). 문법 학습·책갈피에서 함께 씀
import type { ConceptSection as Section } from '../data/types';
import styles from './ConceptSection.module.css';

export default function ConceptSection({ section, showTitle = true }: { section: Section; showTitle?: boolean }) {
  return (
    <section className={styles.section}>
      {showTitle && section.title && <h3 className={styles.title}>{section.title}</h3>}
      {section.blocks.map((b, i) => {
        if (b.type === 'table')
          return (
            <div key={i} className={`${styles.tableWrap} scroll-hidden`}>
              <table className={styles.table}>
                <thead>
                  <tr>{b.headers.map((h, j) => <th key={j}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {b.rows.map((r, j) => (
                    <tr key={j}>{r.map((c, k) => <td key={k}>{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        if (b.type === 'list')
          return (
            <ul key={i} className={styles.list}>
              {b.items.map((t, j) => <li key={j}>{t}</li>)}
            </ul>
          );
        if (b.type === 'h') return <h4 key={i} className={styles.h}>{b.text}</h4>;
        if (b.type === 'note') return <p key={i} className={styles.note}>{b.text}</p>;
        return <p key={i} className={styles.p}>{b.text}</p>;
      })}
    </section>
  );
}
