// 과 제목: lessons.json title의 첫 주제(괄호 설명 뺌). 예) "동사(動詞, verb) / 직설법…" → "동사"
export const shortTitle = (title: string) => title.split(' / ')[0].split(':')[0].replace(/\s*[([].*?[)\]]/g, '').trim();

export const studyPath = (n: number, k: 'word' | 'gram' | 'sent') => `/study/${n}/${k}`;
export const lessonPath = (n: number) => `/learn/${n}`;
