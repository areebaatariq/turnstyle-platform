import fs from 'fs/promises';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'data', 'users.json');

async function deleteAllAccounts() {
  try {
    console.log('🗑️  Starting account deletion...');
    
    // Check if file exists
    try {
      await fs.access(DB_FILE);
    } catch {
      console.log('ℹ️  No users.json file found. Database is already empty.');
      return;
    }

    // Read current users
    const data = await fs.readFile(DB_FILE, 'utf-8');
    const users = JSON.parse(data);
    
    const userCount = users.length;
    
    if (userCount === 0) {
      console.log('ℹ️  Database is already empty. No accounts to delete.');
      return;
    }

    // Delete all accounts by writing empty array
    await fs.writeFile(DB_FILE, JSON.stringify([], null, 2));
    
    console.log(`✅ Successfully deleted ${userCount} account(s) from the database.`);
    console.log(`📁 Database file: ${DB_FILE}`);
  } catch (error: any) {
    console.error('❌ Error deleting accounts:', error.message);
    process.exit(1);
  }
}

// Run the script
deleteAllAccounts();
