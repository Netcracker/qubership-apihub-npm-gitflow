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

const fs = require('fs');
const path = require('path');
const packageJsonPath = path.resolve(process.cwd(), "package.json");
const { 
    checkUncommittedChanges,
    commitAndPush,
    switchToBranchAndPull, 
    mergeFromBranch, 
    createAndPushTag, 
    push, 
    deleteBranch,
    handleError,
    getVersionFromBranch 
} = require('./git-utils');
const { 
    changePackageJsonVersion, 
    changeLernaProjectVersion,
    getIncrementedPatchVersion
} = require('./npm-utils');

/**
 * Finishes a release or hotfix branch workflow
 * 
 * @param {Object} git - The simple-git instance
 * @param {string} branchType - The type of branch ('release' or 'hotfix')
 * @returns {Promise<void>} A promise that resolves when the branch workflow is complete
 */
function finishReleaseBranch(git, branchType) {
    const isLernaProject = fs.existsSync("./lerna.json");
    let branchVersion;
    let sourceBranch;

    return checkUncommittedChanges(git)
        .then(() => switchToBranchAndPull(git, branchType))
        .then(() => validateDependencies())
        .then(() => {
            // Get version in branch
            return getVersionFromBranch(git, branchType, isLernaProject)
                .then(version => {
                    branchVersion = version.match(/\d+\.\d+\.\d+/)[0];
                    sourceBranch = branchType;
                });
        })    
        .then(() => switchToBranchAndPull(git, 'main'))
        .then(() => mergeFromBranch(git, sourceBranch))
        .then(() => isLernaProject ? changeLernaProjectVersion(branchVersion, 'main') : changePackageJsonVersion(branchVersion))
        .then(() => commit(git, branchVersion))
        .then(() => createAndPushTag(git, branchVersion))
        .then(() => push(git))
        .then(() => switchToBranchAndPull(git, "develop"))
        .then(() => mergeFromBranch(git, 'main'))
        .then(() => getVersionFromBranch(git, 'main', isLernaProject))
        .then(version => getIncrementedPatchVersion(version))
        .then(incVersion => isLernaProject ? changeLernaProjectVersion(incVersion, "develop") : changePackageJsonVersion(incVersion))
        .then(() => commitAndPush(git, 'develop', `chore: merge ${branchType} ${branchVersion} to develop`))
        .then(() => deleteBranch(git, sourceBranch));
}

/**
 * Commits changes with a release message
 * 
 * @param {Object} git - The simple-git instance
 * @param {string} version - The version to include in the commit message
 * @returns {Promise<void>} A promise that resolves when the commit is complete
 */
function commit(git, version) {
    return new Promise((resolve) => {
        git.commit(`chore: release: ${version}`, ['--all', '--no-edit'])
            .then(() => {
                console.log("Commit!");
                resolve();
            })
            .catch(handleError);
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

module.exports = {
    finishReleaseBranch,
    validateDependencies
}; 