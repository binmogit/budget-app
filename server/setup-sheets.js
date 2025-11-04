/**
 * Interactive Google Sheets API setup wizard
 * Run with: node server/setup-sheets.js
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message, color = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function header(message) {
  console.log('\n' + '='.repeat(60));
  log(message, COLORS.bright + COLORS.cyan);
  console.log('='.repeat(60) + '\n');
}

async function checkExistingCredentials() {
  const credPath = path.join(__dirname, 'credentials.json');
  try {
    await fs.access(credPath);
    const content = await fs.readFile(credPath, 'utf-8');
    const creds = JSON.parse(content);
    return {
      exists: true,
      email: creds.client_email,
      projectId: creds.project_id,
    };
  } catch {
    return { exists: false };
  }
}

async function findCredentialsInDownloads() {
  const downloadsDir = path.join(process.env.USERPROFILE || process.env.HOME, 'Downloads');
  try {
    const files = await fs.readdir(downloadsDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('credentials'));
    
    const credentialFiles = [];
    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(path.join(downloadsDir, file), 'utf-8');
        const data = JSON.parse(content);
        if (data.type === 'service_account' && data.client_email && data.private_key) {
          credentialFiles.push({
            filename: file,
            email: data.client_email,
            projectId: data.project_id,
            path: path.join(downloadsDir, file),
          });
        }
      } catch {
        // Not a valid service account file, skip
      }
    }
    return credentialFiles;
  } catch {
    return [];
  }
}

async function copyCredentials(sourcePath) {
  const destPath = path.join(__dirname, 'credentials.json');
  try {
    await fs.copyFile(sourcePath, destPath);
    return true;
  } catch (error) {
    log(`Error copying file: ${error.message}`, COLORS.red);
    return false;
  }
}

async function main() {
  header('📊 Google Sheets API Setup Wizard');
  
  log('This wizard will help you set up Google Sheets integration.', COLORS.cyan);
  log('You\'ll need a Google Cloud service account credentials file.\n');

  // Check for existing credentials
  const existing = await checkExistingCredentials();
  if (existing.exists) {
    log('✓ Credentials already configured!', COLORS.green);
    log(`  Service Account: ${existing.email}`);
    log(`  Project: ${existing.projectId}\n`);
    
    const replace = await question('Replace existing credentials? (y/N): ');
    if (replace.toLowerCase() !== 'y') {
      log('\nKeeping existing credentials. Setup complete!', COLORS.green);
      log('\nTo use Google Sheets:', COLORS.bright);
      log(`1. Share your Google Sheet with: ${COLORS.yellow}${existing.email}${COLORS.reset}`);
      log('2. Give it "Viewer" permission');
      log('3. Restart your server with: npm run server\n');
      rl.close();
      return;
    }
  }

  // Auto-detect credentials in Downloads
  log('Searching for service account credentials in Downloads folder...', COLORS.cyan);
  const foundFiles = await findCredentialsInDownloads();
  
  if (foundFiles.length > 0) {
    log(`\n✓ Found ${foundFiles.length} service account file(s):`, COLORS.green);
    foundFiles.forEach((file, i) => {
      log(`  ${i + 1}. ${file.filename}`);
      log(`     Email: ${file.email}`, COLORS.yellow);
      log(`     Project: ${file.projectId}`);
    });
    
    const choice = await question('\nSelect file to use (1-' + foundFiles.length + '), or 0 to enter path manually: ');
    const index = parseInt(choice) - 1;
    
    if (index >= 0 && index < foundFiles.length) {
      const selected = foundFiles[index];
      log(`\nUsing: ${selected.filename}`, COLORS.cyan);
      
      const success = await copyCredentials(selected.path);
      if (success) {
        log('\n✓ Credentials configured successfully!', COLORS.green);
        log('\n📋 Next steps:', COLORS.bright);
        log(`1. Share your Google Sheet with: ${COLORS.yellow}${selected.email}${COLORS.reset}`);
        log('   - Open your Google Sheet');
        log('   - Click the "Share" button');
        log(`   - Add: ${selected.email}`);
        log('   - Give it "Viewer" permission');
        log('   - Click "Send"');
        log('\n2. Restart your server:', COLORS.bright);
        log('   npm run server', COLORS.yellow);
        log('\n3. In the app, click "New" → "📊 Connect Google Sheets"');
        log('   - Paste your Sheet URL');
        log('   - Enter the sheet name (e.g., "Sheet1")');
        log('   - Click "Create"\n');
        rl.close();
        return;
      }
    }
  }

  // Manual path entry
  log('\nEnter the full path to your service account credentials JSON file:', COLORS.cyan);
  log('(Or drag and drop the file here)\n');
  
  const manualPath = await question('Path: ');
  const cleanPath = manualPath.trim().replace(/^["']|["']$/g, ''); // Remove quotes
  
  try {
    const content = await fs.readFile(cleanPath, 'utf-8');
    const data = JSON.parse(content);
    
    if (data.type !== 'service_account' || !data.client_email || !data.private_key) {
      log('\n✗ Invalid service account file format', COLORS.red);
      rl.close();
      return;
    }
    
    const success = await copyCredentials(cleanPath);
    if (success) {
      log('\n✓ Credentials configured successfully!', COLORS.green);
      log('\n📋 Next steps:', COLORS.bright);
      log(`1. Share your Google Sheet with: ${COLORS.yellow}${data.client_email}${COLORS.reset}`);
      log('2. Restart your server: npm run server', COLORS.yellow);
      log('3. Connect to your sheet in the app\n');
    }
  } catch (error) {
    log(`\n✗ Error: ${error.message}`, COLORS.red);
    log('\nMake sure the file exists and is a valid JSON file.\n');
  }
  
  rl.close();
}

// Handle setup instructions if no credentials found
async function showSetupInstructions() {
  header('🔧 How to Create Service Account Credentials');
  
  log('Follow these steps:', COLORS.bright);
  log('\n1. Go to Google Cloud Console:', COLORS.cyan);
  log('   https://console.cloud.google.com/', COLORS.yellow);
  
  log('\n2. Create/Select a Project:', COLORS.cyan);
  log('   - Click the project dropdown at the top');
  log('   - Click "New Project"');
  log('   - Name it (e.g., "Budget App")');
  log('   - Click "Create"');
  
  log('\n3. Enable Google Sheets API:', COLORS.cyan);
  log('   - Go to "APIs & Services" → "Library"');
  log('   - Search for "Google Sheets API"');
  log('   - Click "Enable"');
  
  log('\n4. Create Service Account:', COLORS.cyan);
  log('   - Go to "APIs & Services" → "Credentials"');
  log('   - Click "Create Credentials" → "Service Account"');
  log('   - Name it "budget-app-reader"');
  log('   - Click "Create and Continue" → "Done"');
  
  log('\n5. Generate Key:', COLORS.cyan);
  log('   - Click on the service account you just created');
  log('   - Go to "Keys" tab');
  log('   - Click "Add Key" → "Create new key"');
  log('   - Choose "JSON" format');
  log('   - Click "Create" (file will download)');
  
  log('\n6. Run this setup wizard again:', COLORS.cyan);
  log('   node server/setup-sheets.js', COLORS.yellow);
  log('   (The wizard will auto-detect the downloaded file)\n');
}

// Run main or show instructions based on argument
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  showSetupInstructions().then(() => rl.close());
} else {
  main().catch(error => {
    log(`\nUnexpected error: ${error.message}`, COLORS.red);
    rl.close();
    process.exit(1);
  });
}
