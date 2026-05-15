import fs from 'fs';
const envStr = fs.readFileSync('.env.local', 'utf-8');
const match = envStr.match(/^DATABASE_URL=(.*)$/m);
if (match) process.env.DATABASE_URL = match[1].trim();

import sql from '../lib/db';
import { computeStudentDimensions } from '../lib/readiness';

async function run() {
  const [student] = await sql`
    SELECT students.*, users.email FROM students 
    JOIN users ON users.id = students.user_id 
    WHERE users.email = 'ahmedtest2@example.com'
  `;
  
  if (!student) {
    console.error('Student not found');
    process.exit(1);
  }

  console.log('Old GPA:', student.gpa_value);
  const oldScore = await sql`SELECT general_readiness FROM student_dimensions WHERE student_id = ${student.user_id}`;
  console.log('Old Readiness:', oldScore[0]?.general_readiness);

  console.log('Updating GPA to 4.0 (scale 5.0)');
  await sql`UPDATE students SET gpa_value = 4.0 WHERE user_id = ${student.user_id}`;

  console.log('Recomputing...');
  const newScore = await computeStudentDimensions(student.user_id);
  console.log('New Readiness:', newScore.general_readiness);
  
  process.exit(0);
}

run();
