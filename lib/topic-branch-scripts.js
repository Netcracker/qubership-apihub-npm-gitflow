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

const fs = require("fs");
const { 
    checkUncommittedChanges, 
    commitAndPush,
    getCurrentBranchName, 
    getVersionFromBranch,
    switchToBranchAndPull,
    pushNewBranch,
    deleteBranch,
    createBranch,
    updateBranchWithDevelop,
    mergeToDevelop,
    handleError 
} = require('./git-utils');
const { 
    changePackageJsonVersion, 
    changeLernaProjectVersion, 
    updateDistTagsDependenciesAndLockFiles 
} = require('./npm-utils');

/**
 * Creates a new branch of specified type from develop
 * 
 * @param {Object} git - The simple-git instance
 * @param {string} branchType - The type of branch (feature, bugfix, etc.)
 * @param {string} branchName - The name for the branch
 * @returns {Promise<void>} A promise that resolves when the branch workflow is complete
 */
function startTopicBranch(git, branchType, branchName) {
    if (!branchName || typeof branchName === "boolean") {
        console.log(`${branchType} name must not be empty!`);
        process.exit(0);
    }

    return checkUncommittedChanges(git)
        .then(() => switchToBranchAndPull(git, 'develop'))
        .then(() => createBranch(git, branchType, branchName))    
        .then(() => pushNewBranch(git, `${branchType}/${branchName}`))
        .then(() => printStartSummary(branchName, branchType));
}

/**
 * Prints a summary of actions after starting a branch
 * 
 * @param {string} branchName - The name for the branch
 * @param {string} branchType - The type of branch (feature, bugfix, etc.)
 */
function printStartSummary(branchName, branchType) {
    console.log("Summary of actions: ");
    console.log(`A new branch ${branchType}/${branchName} was created, based on 'develop'`);
    console.log(`You are now on branch ${branchType}/${branchName}`);
}

/**
 * Finishes a branch workflow by merging into develop and cleaning up
 * 
 * @param {Object} git - The simple-git instance
 * @param {string} branchType - The type of branch (feature, bugfix, etc.)
 * @param {boolean} [squash=false] - Whether to squash the commits during merge
 * @param {string} [customMessage] - Custom commit message when squashing
 * @returns {Promise<void>} A promise that resolves when the branch workflow is complete
 */
function finishTopicBranch(git, branchType, squash = false, customMessage) {
    const isLernaProject = fs.existsSync("./lerna.json");
    let currentBranch;

    return checkUncommittedChanges(git)
        .then(() => getCurrentBranchName(git))
        .then(branch => {
            if (branch.search(branchType) === -1) {
                handleError(`You are trying to finish not ${branchType} branch: ${branch}`);
            }
            currentBranch = branch;
            return updateBranchWithDevelop(git);
        })
        .then(() => switchToBranchAndPull(git, 'develop'))
        .then(() => mergeToDevelop(git, currentBranch, squash))
        .then(() => getVersionFromBranch(git, 'develop', isLernaProject))
        .then((version) => isLernaProject ? changeLernaProjectVersion(version) : changePackageJsonVersion(version))
        .then(() => updateDistTagsDependenciesAndLockFiles(isLernaProject, version => (version.startsWith('feature') || version.startsWith('bugfix')), 'dev'))
        .then(() => {
            const commitMessage = squash && customMessage 
                ? customMessage 
                : `chore: merge from ${currentBranch} to develop`;
            return commitAndPush(git, 'develop', commitMessage);
        })
        .then(() => deleteBranch(git, currentBranch));
}

module.exports = {
    startTopicBranch,
    finishTopicBranch
}; 