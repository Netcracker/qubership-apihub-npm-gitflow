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
const semver = require('semver');
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
    getVersionCore,
    getIncrementedPatchVersion
} = require('./npm-utils');
const { validateDependencies } = require('./validate-dependencies');

/**
 * Finishes a release or hotfix branch workflow
 * 
 * @param {Object} git - The simple-git instance
 * @param {string} branchName - The name of release branch ('release' or 'hotfix')
 * @param {Set<string>} packagesToExcludeFromVersionValidation - Set of package names to exclude from version validation
 * @returns {Promise<void>} A promise that resolves when the branch workflow is complete
 */
function finishReleaseBranch(git, branchName, packagesToExcludeFromVersionValidation = new Set()) {
    const isLernaProject = fs.existsSync("./lerna.json");
    let branchVersion;
    let sourceBranch;

    return checkUncommittedChanges(git)
        .then(() => switchToBranchAndPull(git, branchName))
        .then(() => validateDependencies('main', packagesToExcludeFromVersionValidation))
        .then(() => {
            // Get version in branch
            return getVersionFromBranch(git, branchName, isLernaProject)
                .then(version => {
                    branchVersion = getVersionCore(version);
                    if (!branchVersion) {
                        handleError(new Error(`Invalid version format: ${version}`));
                    }
                    sourceBranch = branchName;
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
        .then(version => {
            const incVersion = getIncrementedPatchVersion(version);
            if (!incVersion) {
                handleError(new Error(`Invalid version format: ${version}`));
            }
            return isLernaProject ? changeLernaProjectVersion(incVersion, "develop") : changePackageJsonVersion(incVersion);
        })
        .then(() => commitAndPush(git, 'develop', `chore: merge ${branchName} ${branchVersion} to develop`))
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

module.exports = {
    finishReleaseBranch
}; 