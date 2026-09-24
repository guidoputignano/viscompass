// Registers the "@/" resolver for the test runner. Loaded via --import in the
// test script so it applies to every test file, including the child processes
// `node --test` spawns per file.
import {register} from 'node:module';
register('./_alias-hooks.mjs', import.meta.url);
