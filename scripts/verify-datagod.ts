import { fetchDataGodBalance } from '../lib/datagod-service';

/**
 * DataGod Configuration Verification Script
 *
 * This script verifies if the DataGod API key is correctly configured
 * and if it can successfully connect to the DataGod API.
 *
 * Usage: npx tsx scripts/verify-datagod.ts
 */

async function main() {
    console.log('--- DataGod Configuration Verification ---');
    console.log('Base URL:', process.env.DATAGOD_API_BASE_URL || 'https://datagod.store/api/v1');
    console.log('API Key Status:', process.env.DATAGOD_API_KEY ? 'Present' : 'MISSING');

    if (!process.env.DATAGOD_API_KEY) {
        console.error('ERROR: DATAGOD_API_KEY is not set in environment variables.');
        process.exit(1);
    }

    console.log('\nAttempting to fetch balance...');

    try {
        const result = await fetchDataGodBalance();

        if (result.success) {
            console.log('SUCCESS: Connection to DataGod established!');
            console.log(`User: ${result.username} (${result.role})`);
            console.log(`Balance: ${result.currency} ${result.balance?.toFixed(2)}`);
        } else {
            console.error('FAILURE: Could not connect to DataGod.');
            console.error(`Error: ${result.error}`);
            process.exit(1);
        }
    } catch (error: any) {
        console.error('EXCEPTION: An unexpected error occurred.');
        console.error(error.message);
        process.exit(1);
    }
}

main();
