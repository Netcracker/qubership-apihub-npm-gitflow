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
const fs = require('fs');
const path = require('path');
const isLernaProject = fs.existsSync("./lerna.json");
const packageJsonPath = path.resolve(process.cwd(), "package.json");
const packageJsonFile = require(packageJsonPath);
const { 
    checkUncommittedChanges, 
    switchToBranchAndPull, 
    handleError,
    getVersionFromBranch,
    commitAndPush,
    checkRemoteBranchExists
} = require('../lib/git-utils');
const { 
    changePackageJsonVersion,
    changeLernaProjectVersion,
    getIncrementedPatchVersion
} = require('../lib/npm-utils');

// Check if hotfix is already in progress and exit if true
checkUncommittedChanges(git)
    .then(() => checkRemoteBranchExists(git, 'hotfix'))
    .then(exists => {
        if (exists) {
            console.error('Error: Hotfix branch already exists. A hotfix is already in progress.');
            process.exit(1);
        }
        return switchToBranchAndPull(git, 'main');
    })
    .then(() => getVersionFromBranch(git, 'main', isLernaProject))
    .then(version => {
        const hotfixVersion = getIncrementedPatchVersion(version);
        if (!hotfixVersion) {
            handleError(new Error(`Invalid version format: ${version}`));
        }
        return createHotfixBranch(hotfixVersion);
    })
    .then(hotfixVersion => commitAndPush(git, 'hotfix', `chore: hotfix started, hotfix version ${hotfixVersion}`));

/**
 * Creates hotfix branch and sets the version
 * 
 * @param {string} hotfixVersion - The hotfix version to set
 * @returns {Promise<string>} A promise that resolves with the hotfix version
 */
function createHotfixBranch(hotfixVersion) {
    return new Promise((resolve) => {
        git.checkoutBranch('hotfix', 'main')
            .then(() => {
                console.log("Created hotfix branch from main");
                
                // Set the version in the appropriate file
                const versionPromise = isLernaProject 
                    ? changeLernaProjectVersion(hotfixVersion, 'hotfix')
                    : changePackageJsonVersion(hotfixVersion);
                
                versionPromise.then(() => {
                    console.log(`Set hotfix version to ${hotfixVersion}`);
                    resolve(hotfixVersion);
                });
            })
            .catch(handleError);
    });
} 