#!/usr/bin/env node

/**
 * OpenQode Authentication Helper
 * Handles the Vision API OAuth flow during installation.
 */

const { QwenOAuth } = require('../qwen-oauth');
const readline = require('readline');
const { exec } = require('child_process');
const os = require('os');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const oauth = new QwenOAuth();

async function openBrowser(url) {
    const platform = os.platform();
    let command;

    if (platform === 'win32') {
        command = `start "${url}"`;
    } else if (platform === 'darwin') {
        command = `open "${url}"`;
    } else {
        command = `xdg-open "${url}"`;
    }

    exec(command, (error) => {
        if (error) {
            console.log('  (Please open the URL manually if it didn\'t open)');
        }
    });
}

console.log('\n========================================================');
console.log('  OpenQode Vision API Authentication');
console.log('========================================================\n');
console.log('This step authorizes OpenQode to see images (Vision features).');
console.log('You will also be asked to login to the CLI separately if needed.\n');

(async () => {
    try {
        const flow = await oauth.startDeviceFlow();

        console.log(`\n  1. Your User Code is: \x1b[1;33m${flow.userCode}\x1b[0m`);
        console.log(`  2. Please verify at:  \x1b[1;36m${flow.verificationUri}\x1b[0m`);
        console.log('\n  Opening browser...');

        openBrowser(flow.verificationUriComplete || flow.verificationUri);

        console.log('\n  Waiting for you to complete login in the browser...');

        const tokens = await oauth.pollForTokens();

        console.log('\n\x1b[1;32m  Success! Vision API authenticated.\x1b[0m');
        console.log('  Tokens saved to .qwen-tokens.json\n');

    } catch (error) {
        console.error(`\n\x1b[1;31m  Authentication failed: ${error.message}\x1b[0m\n`);
    } finally {
        rl.close();
    }
})();
