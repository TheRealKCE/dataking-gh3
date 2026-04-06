const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(fullPath));
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            results.push(fullPath);
        }
    });
    return results;
}

const targetDirs = [
    'app/api/admin',
    'app/api/users',
    'app/api/orders',
    'app/api/payments',
    'app/api/shop',
    'app/api/agent',
    'app/api/airtime',
    'app/api/complaints',
    'app/api/support-chat',
    'app/api/user',
];

let files = [];
targetDirs.forEach(dir => {
    files = files.concat(walk(dir));
});

let changedCount = 0;
let skippedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    const orig = content;

    // Only process files that actually use getSession
    if (!content.includes('auth.getSession()')) {
        return;
    }

    // --- Step 1: Replace the getSession destructure ---
    // Pattern: const { data: { session }, error: sessionError } = await X.auth.getSession()
    // Replaces with:  const { data: { user: authUser }, error: authError } = await X.auth.getUser()
    content = content.replace(
        /const\s*\{\s*data\s*:\s*\{\s*session\s*\}\s*,\s*error\s*:\s*sessionError\s*\}\s*=\s*await\s+([a-zA-Z0-9_.]+)\.auth\.getSession\(\)/g,
        'const { data: { user: authUser }, error: authError } = await $1.auth.getUser()'
    );

    // Pattern without error: const { data: { session } } = await X.auth.getSession()
    content = content.replace(
        /const\s*\{\s*data\s*:\s*\{\s*session\s*\}\s*\}\s*=\s*await\s+([a-zA-Z0-9_.]+)\.auth\.getSession\(\)/g,
        'const { data: { user: authUser } } = await $1.auth.getUser()'
    );

    // --- Step 2: Replace the guard clauses using sessionError / session ---
    content = content.replace(/sessionError\s*\|\|\s*!session\?\.user/g, 'authError || !authUser');
    content = content.replace(/sessionError\s*\|\|\s*!session\.user/g, 'authError || !authUser');
    content = content.replace(/sessionError\s*\|\|\s*!session/g, 'authError || !authUser');

    // --- Step 3: Replace session.user.id / session?.user?.id accesses ---
    content = content.replace(/session\?\.user\?\.id/g, 'authUser?.id');
    content = content.replace(/session\?\.user\.id/g, 'authUser?.id');
    content = content.replace(/session\.user\.id/g, 'authUser.id');

    // --- Step 4: Replace other session.user property accesses ---
    content = content.replace(/session\?\.user\?\.([a-zA-Z_]+)/g, 'authUser?.$1');
    content = content.replace(/session\?\.user\.([a-zA-Z_]+)/g, 'authUser?.$1');
    content = content.replace(/session\.user\.([a-zA-Z_]+)/g, 'authUser.$1');

    // --- Step 5: Replace standalone session.user references ---
    content = content.replace(/session\?\.user\b/g, 'authUser');
    content = content.replace(/session\.user\b/g, 'authUser');

    // --- Step 6: Check for remaining session references that might need attention ---
    // If there are still session-related patterns we missed, log for manual review
    const remainingSessionRefs = (content.match(/\bsession\b/g) || []).length;

    if (orig !== content) {
        if (remainingSessionRefs === 0 || !content.includes('auth.getSession()')) {
            fs.writeFileSync(file, content, 'utf8');
            changedCount++;
            console.log(`✅ Updated: ${file}`);
            if (remainingSessionRefs > 0) {
                console.log(`   ⚠️  ${remainingSessionRefs} remaining 'session' ref(s) - please verify manually`);
            }
        } else {
            console.log(`⚠️  SKIPPED (has remaining getSession): ${file}`);
            skippedCount++;
        }
    }
});

console.log(`\n=== Done ===`);
console.log(`Updated : ${changedCount} files`);
console.log(`Skipped : ${skippedCount} files (check manually)`);
