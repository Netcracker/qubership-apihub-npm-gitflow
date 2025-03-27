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

const git = require("simple-git")();
const fs = require("fs");
const isLernaProject = fs.existsSync("./lerna.json");
const { 
    checkUncommittedChanges, 
    getCurrentBranchName, 
    switchToBranchAndPull,
    mergeFromBranch,
    deleteBranch,
    handleError 
} = require('../lib/git-utils');
const { 
    changePackageJsonVersion, 
    changeLernaProjectVersion, 
    updateDistTagsDependenciesAndLockFiles 
} = require('../lib/npm-utils');

let featureBranch;

checkUncommittedChanges(git)
    .then(() => getCurrentBranchName(git))
    .then(branch => {
        if (branch.search("feature") === -1) handleError("You are trying to finish not feature branch: " + branch);
        this.featureBranch = branch;
    })
    .then(() => updateFeatureBranchToDevelop(git))
    .then(() => switchToBranchAndPull(git, 'develop'))
    .then(() => mergeToDevelop(git, this.featureBranch))
    .then(() => getVersionFromBranch(git, 'develop', isLernaProject))
    .then((version) => isLernaProject ? changeLernaProjectVersion(version) : changePackageJsonVersion(version))
    .then(() => updateDistTagsDependenciesAndLockFiles(isLernaProject, version => version.startsWith('feature'), 'dev'))
    .then(() => commitAndPush(git, 'develop', 'chore: merge from ' + this.featureBranch + ' to develop'))
    .then(() => deleteBranch(git, this.featureBranch));

/**
 * Updates the feature branch with latest changes from develop
 * 
 * @param {Object} git - The simple-git instance
 * @returns {Promise<void>} A promise that resolves when the branch is updated
 */
function updateFeatureBranchToDevelop(git) {
    return new Promise(resolve => {
        git.pull('origin', 'develop', ['--no-rebase', '--progress', '-v'])
            .then(() => {
                resolve();
            })
            .catch(handleError);
    });
}

/**
 * Merges a feature branch into develop
 * 
 * @param {Object} git - The simple-git instance
 * @param {string} branch - The feature branch to merge
 * @returns {Promise<void>} A promise that resolves when the merge is complete
 */
function mergeToDevelop(git, branch) {
    return new Promise(resolve => {
        git.mergeFromTo(branch, "develop", ["--no-edit", "--no-commit", "--no-ff"], (err) => {
            handleError(err);
            console.log("Merge from " + branch + " to develop. You are now at develop.");
            resolve();
        });
    });
}
