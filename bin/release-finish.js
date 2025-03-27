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
const packageJsonPath = path.resolve(process.cwd(), "package.json");
const packageJsonFile = require(packageJsonPath);
const isLernaProject = fs.existsSync("./lerna.json");
const { 
    checkUncommittedChanges,     
    switchToBranchAndPull, 
    mergeFromBranch, 
    createAndPushTag, 
    push, 
    deleteBranch,
    handleError,
    getVersionFromBranch 
} = require('../lib/git-utils');
const { 
    changePackageJsonVersion, 
    changeLernaProjectVersion 
} = require('../lib/npm-utils');

let releaseBranch;
let version;

checkUncommittedChanges(git)
    .then(() => switchToBranchAndPull(git, 'release'))
    .then(() => validateDependencies())
    .then(() => {
        //Get version in release branch
        return getVersionFromBranch(git, 'release', isLernaProject)
            .then(version => {
                this.version = version.match(/\d+\.\d+\.\d+/)[0];
                this.releaseBranch = 'release';
            });
    })    
    .then(() => switchToBranchAndPull(git, 'main'))
    .then(() => mergeFromBranch(git, this.releaseBranch))
    .then(() => isLernaProject ? changeLernaProjectVersion(this.version, 'main') : changePackageJsonVersion(this.version))
    .then(() => commit(this.version))
    .then(() => createAndPushTag(git, this.version))
    .then(() => push(git))
    .then(() => switchToBranchAndPull(git, "develop"))
    .then(() => mergeFromBranch(git, 'main'))
    .then(() => isLernaProject ? getIncrementedLernaVersion() : getIncrementedPackageJsonVersion())
    .then(incVersion => isLernaProject ? changeLernaProjectVersion(incVersion + "-dev.0", "develop") : changePackageJsonVersion(incVersion + "-dev.0"))
    .then(() => commitAndPush(git, 'develop', 'chore: merge release ' + this.version + ' to develop'))
    .then(() => deleteBranch(git, this.releaseBranch));

/**
 * Commits changes with a release message
 * 
 * @param {string} message - The version to include in the commit message
 * @returns {Promise<void>} A promise that resolves when the commit is complete
 */
function commit(message) {
    return new Promise((resolve) => {
        git.commit('chore: release: ' + message, ['--all', '--no-edit'])
            .then(() => {
                console.log("Commit!");
                resolve();
            })
            .catch(handleError);
    });
}

/**
 * Gets the incremented version from lerna.json
 * 
 * @returns {Promise<string>} A promise that resolves with the incremented version
 */
function getIncrementedLernaVersion() {
    return new Promise((resolve) => {
        const lernaFile = require(path.resolve(process.cwd(), "lerna.json"));
        let version = lernaFile.version.match(/\d+\.\d+\.\d+/)[0];
        let incrementedVersion = version.replace(/\d+$/, (n) => ++n);
        resolve(incrementedVersion);
    });
}

/**
 * Gets the incremented version from package.json
 * 
 * @returns {Promise<string>} A promise that resolves with the incremented version
 */
function getIncrementedPackageJsonVersion() {
    return new Promise((resolve) => {
        let version = packageJsonFile.version.match(/\d+\.\d+\.\d+/)[0];
        let incrementedVersion = version.replace(/\d+$/, (n) => ++n);
        resolve(incrementedVersion);
    });
}

/**
 * Validates that all dependencies are using release versions
 * 
 * @returns {Promise<void>} A promise that resolves when validation is complete
 */
function validateDependencies() {
    return new Promise((resolve) => {
        const packageJson = require(packageJsonPath);
        const invalidTags = ['dev', 'next'];
        
        const dependencies = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
            ...packageJson.peerDependencies
        };

        const invalidDeps = [];
        
        for (const [dep, version] of Object.entries(dependencies)) {
            if (typeof version === 'string') {
                // Check for invalid tags
                if (invalidTags.some(tag => version === tag)) {
                    invalidDeps.push(`${dep}@${version}`);
                }
                // Check for feature branches
                if (version.startsWith('feature')) {
                    invalidDeps.push(`${dep}@${version}`);
                }
            }
        }

        if (invalidDeps.length > 0) {
            const errorMessage = 'Cannot proceed with release. The following dependencies must be updated to release versions:\n' + 
                               invalidDeps.map(dep => `  - ${dep}`).join('\n');
            handleError(new Error(errorMessage));
        }
        
        console.log('Dependencies validation passed');
        resolve();
    });
}
