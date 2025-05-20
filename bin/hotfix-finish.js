#! /usr/bin/env node
/**
 * Copyright 2024-2025 NetCracker Technology Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const git = require('simple-git')();
const commandLineArgs = require('command-line-args');
const { finishReleaseBranch } = require('../lib/release-branch-scripts');

// Define command line options
const optionDefinitions = [
    {
        name: 'no-version-check',
        type: String,
        multiple: true,
        defaultValue: [],
        description: 'List of packages to exclude from version validation'
    }
];

// Parse command line arguments
const options = commandLineArgs(optionDefinitions);

// Validate that if --no-version-check is specified, it must have at least one package
if (process.argv.includes('--no-version-check') && options['no-version-check'].length === 0) {
    console.error('Error: --no-version-check flag requires at least one package to be specified');
    process.exit(1);
}

// Convert array of packages to Set
const packagesToExcludeFromVersionValidation = new Set(options['no-version-check']);

// Execute the hotfix finish workflow
finishReleaseBranch(git, 'hotfix', packagesToExcludeFromVersionValidation); 