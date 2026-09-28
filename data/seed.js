const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const Database = require('better-sqlite3');

const excelFilePath = path.join(__dirname, '../../제3과_헬라어_학습DB.xlsx');
const dbFilePath = path.join(__dirname, 'db.sqlite');

function seed() {
  console.log(`Reading Excel file from ${excelFilePath}...`);
  if (!fs.existsSync(excelFilePath)) {
    console.error('Excel file not found!');
    process.exit(1);
  }

  const workbook = xlsx.readFile(excelFilePath);
  const sheetName = 'words';
  
  if (!workbook.Sheets[sheetName]) {
    console.error(`Sheet "${sheetName}" not found in the Excel file!`);
    process.exit(1);
  }

  const sheet = workbook.Sheets[sheetName];
  // Convert sheet to JSON, treating the first row as headers
  const data = xlsx.utils.sheet_to_json(sheet, { defval: null });
  
  console.log(`Found ${data.length} rows in "${sheetName}" sheet.`);

  // Connect to SQLite DB
  const db = new Database(dbFilePath);
  
  // Drop and recreate table
  console.log('Initializing database table...');
  db.exec(`
    DROP TABLE IF EXISTS words;
    CREATE TABLE words (
      word_id TEXT PRIMARY KEY,
      lesson_id TEXT,
      word TEXT,
      stem TEXT,
      part_of_speech TEXT,
      meaning TEXT,
      gender_id TEXT,
      declension TEXT,
      type_id TEXT,
      note TEXT
    );
  `);

  const insertStmt = db.prepare(`
    INSERT INTO words (word_id, lesson_id, word, stem, part_of_speech, meaning, gender_id, declension, type_id, note)
    VALUES (@word_id, @lesson_id, @word, @stem, @part_of_speech, @meaning, @gender_id, @declension, @type_id, @note)
  `);

  const processValue = (val) => {
    if (val === null || val === undefined) return null;
    const strVal = String(val).trim();
    return strVal.toLowerCase() === 'none' ? null : strVal;
  };

  let insertedCount = 0;
  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      // 1열 무시: we just extract specific keys based on exact column names
      const rowData = {
        word_id: processValue(row['word_id']),
        lesson_id: processValue(row['lesson_id']),
        word: processValue(row['단어']),
        stem: processValue(row['어간']),
        part_of_speech: processValue(row['품사']),
        meaning: processValue(row['뜻']),
        gender_id: processValue(row['성_id']),
        declension: processValue(row['곡용']),
        type_id: processValue(row['유형_id']),
        note: processValue(row['비고'])
      };

      if (!rowData.word_id) {
        // Skip empty rows if word_id is missing
        continue;
      }
      insertStmt.run(rowData);
      insertedCount++;
    }
  });

  insertMany(data);
  db.close();

  console.log(`Seeding complete. ${insertedCount} rows inserted into db.sqlite.`);
}

seed();
