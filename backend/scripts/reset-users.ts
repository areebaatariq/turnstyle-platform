import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

async function resetUsers() {
  try {
    // Ensure data directory exists
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    // Reset users to empty array
    await fs.writeFile(USERS_FILE, JSON.stringify([], null, 2));
    
    console.log('✅ All user accounts have been deleted from the database.');
    console.log(`   File: ${USERS_FILE}`);
  } catch (error: any) {
    console.error('❌ Error resetting users:', error.message);
    process.exit(1);
  }
}

resetUsers();
