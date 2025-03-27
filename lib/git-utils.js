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

const exec = require('child_process').exec;
const fs = require('fs');
const path = require('path');

/**
 * Handles errors in a consistent way across all scripts
 * 
 * @param {Error} err - The error to handle
 */
function handleError(err) {
    if (err) {
        console.log(err);
        process.exit(1);
    }
}

/**
 * Checks if there are uncommitted changes in the working directory.
 * Fails the script with an error message if uncommitted changes are found.
 * 
 * @param {Object} git - The simple-git instance
 * @returns {Promise<void>} A promise that resolves if the working directory is clean
 */
function checkUncommittedChanges(git) {
    return new Promise((resolve, reject) => {
        git.status((err, status) => {
            if (err) {
                handleError(err);
            }
            
            if (!status.isClean()) {
                console.error("Error: You have uncommitted changes in your working directory.");
                console.error("Please commit or stash your changes before proceeding.");
                process.exit(1);
            }
            
            console.log("Working directory is clean. Proceeding...");
            resolve();
        });
    });
}

/**
 * Gets the current branch name
 * 
 * @param {Object} git - The simple-git instance
 * @returns {Promise<string>} A promise that resolves with the current branch name
 */
function getCurrentBranchName(git) {
    return new Promise(resolve => {
        git.branch((err, data) => {
            handleError(err);
            let branch = data["current"];
            console.log("Current branch: " + branch);
            resolve(branch);
        });
    });
}

/**
 * Switches to a specified branch
 * 
 * @param {Object} git - The simple-git instance
 * @param {string} branch - The branch to switch to
 * @returns {Promise<void>} A promise that resolves when the branch is switched
 */
function switchToBranch(git, branch) {
    return new Promise(resolve => {
        git.checkout(branch, (err) => {
            handleError(err);
            console.log("Switch to " + branch + "!");
            resolve();
        });
    });
}

/**
 * Switches to develop branch and pulls latest changes
 * 
 * @param {Object} git - The simple-git instance
 * @returns {Promise<void>} A promise that resolves when switched to develop and updated
 */
function switchToDevelopAndPull(git) {
    return new Promise(resolve => {
        git.checkout('develop')
            .pull()
            .then(() => {
                console.log("Switch to develop and update!");
                resolve();
            })
            .catch(handleError);
    });
}

/**
 * Creates a new feature branch from develop
 * 
 * @param {Object} git - The simple-git instance
 * @param {string} featureName - The name of the feature
 * @returns {Promise<void>} A promise that resolves when the feature branch is created
 */
//TODO: combine with createReleaseBranch?
function createFeatureBranch(git, featureName) {
    return new Promise(resolve => {
        git.checkoutLocalBranch("feature/" + featureName, (err) => {
            handleError(err);
            console.log("Created feature branch: feature/" + featureName);
            resolve();
        });
    });
}

/**
 * Creates a release branch from develop
 * 
 * @param {Object} git - The simple-git instance
 * @param {string} releaseVersion - The version for the release
 * @returns {Promise<void>} A promise that resolves when the release branch is created
 */
function createReleaseBranch(git, releaseVersion) {
    return new Promise(resolve => {
        git.checkoutBranch('release', 'develop')
            .then(() => {
                console.log("Create release branch with version: " + releaseVersion);
                resolve();
            })
            .catch(handleError);
    });
}

/**
 * Deletes a branch both locally and remotely
 * 
 * @param {Object} git - The simple-git instance
 * @param {string} branch - The branch to delete
 * @returns {Promise<void>} A promise that resolves when the branch is deleted
 */
function deleteBranch(git, branch) {
    return new Promise((resolve) => {
        git.push(['origin', '--delete', branch])
            .then(() => git.deleteLocalBranch(branch))
            .then(() => {
                console.log("Branch " + branch + " was deleted!");
                resolve();
            })
            .catch(handleError);
    });
}

/**
 * Merges from one branch to another
 * 
 * @param {Object} git - The simple-git instance
 * @param {string} fromBranch - The source branch
 * @param {string} toBranch - The target branch
 * @returns {Promise<void>} A promise that resolves when the merge is complete
 */
function mergeFromBranch(git, fromBranch, toBranch) {
    return new Promise(resolve => {
        git.merge(['--no-ff', fromBranch])
            .then(() => {
                console.log(`Merge from ${fromBranch} to ${toBranch}!`);
                resolve();
            })
            .catch(handleError);
    });
}

/**
 * Commits changes with a message and pushes to the specified branch
 * 
 * @param {Object} git - The simple-git instance
 * @param {string} message - The commit message
 * @param {string} branch - The branch to push to
 * @param {boolean} setUpstream - Whether to set upstream
 * @returns {Promise<void>} A promise that resolves when commit and push are complete
 */
function commitAndPush(git, branch, message, setUpstream = false) {
    return new Promise((resolve) => {
        const pushOptions = setUpstream ? ['--set-upstream'] : [];
        
        git.commit(message, ['--all', '--no-edit'])
            .then(() => {
                console.log("Commit!");
                return git.push('origin', branch, pushOptions);
            })
            .then(() => {
                console.log("Push!");
                resolve();
            })
            .catch(handleError);
    });
}

/**
 * Pushes current branch to remote
 * 
 * @param {Object} git - The simple-git instance
 * @returns {Promise<void>} A promise that resolves when push is complete
 */
function push(git) {
    return new Promise((resolve) => {
        git.push()
            .then(() => {
                console.log("Push!");
                resolve();
            })
            .catch(handleError);
    });
}

/**
 * Gets version from package.json or lerna.json in a specific branch
 * 
 * @param {Object} git - The simple-git instance
 * @param {string} branch - The branch to get version from
 * @param {boolean} isLernaProject - Whether this is a lerna project
 * @returns {Promise<string>} A promise that resolves with the version
 */
function getVersionFromBranch(git, branch, isLernaProject) {
    return new Promise(resolve => {
        git.show([`${branch}:${isLernaProject ? "lerna.json" : "package.json"}`], (err, data) => {
            handleError(err);
            const version = JSON.parse(data)["version"];
            console.log(`${branch} version: ${version}`);
            resolve(version);
        });
    });
}

/**
 * Creates and pushes a git tag
 * 
 * @param {Object} git - The simple-git instance
 * @param {string} version - The version to tag
 * @returns {Promise<void>} A promise that resolves when tag is created and pushed
 */
function createAndPushTag(git, version) {
    return new Promise(resolve => {
        git.addAnnotatedTag(version, `release: ${version}`)
            .then(() => git.pushTags())
            .then(() => {
                console.log("Git tag. Version: " + version);
                console.log("Git push tags");
                resolve();
            })
            .catch(handleError);
    });
}

/**
 * Pulls all branches
 * 
 * @param {Object} git - The simple-git instance
 * @returns {Promise<void>} A promise that resolves when all branches are pulled
 */
function pullAll(git) {
    return new Promise(resolve => {
        git.pull(['--all'])
            .then(() => {
                console.log("Pull all branches");
                resolve();
            })
            .catch(handleError);
    });
}

module.exports = {
    handleError,
    checkUncommittedChanges,
    getCurrentBranchName,
    switchToBranch,
    switchToDevelopAndPull,
    createFeatureBranch,
    createReleaseBranch,
    deleteBranch,
    mergeFromBranch,
    commitAndPush,
    push,
    getVersionFromBranch,
    createAndPushTag,
    pullAll
}; 