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

const commandLineArgs = require("command-line-args");
const git = require('simple-git')();
const fs = require('fs');
const path = require('path');
const isLernaProject = fs.existsSync("./lerna.json");
const packageJsonPath = path.resolve(process.cwd(), "package.json");
const packageJsonFile = require(packageJsonPath);
const { 
    checkUncommittedChanges, 
    switchToBranchAndPull, 
    createReleaseBranch, 
    commitAndPush,
    handleError,
    checkRemoteBranchExists
} = require('../lib/git-utils');
const { 
    updateDistTagsDependencies,
    changePackageJsonVersion,
    changeLernaProjectVersion,
    getVersionCore
} = require('../lib/npm-utils');

// Parse command line arguments
const optionDefinitions = [
    { name: 'version', type: String, defaultOption: true, defaultValue: '' }
];

const options = commandLineArgs(optionDefinitions);
let specifiedVersion = options.version;

// Check if version is specified and validate
if (specifiedVersion) {
    // Validate version using getVersionCore
    const versionCore = getVersionCore(specifiedVersion);
    if (!versionCore) {
        console.error('Error: Version must be a valid semver format (e.g., 1.2.3)');
        process.exit(1);
    }
    
    // Ensure specifiedVersion equals its version core
    if (specifiedVersion !== versionCore) {
        console.error(`Error: Version should only include Major.Minor.Patch`);
        process.exit(1);
    }
}

// Check if release is already in progress and exit if true
checkUncommittedChanges(git)
    .then(() => checkRemoteBranchExists(git, 'release'))
    .then(exists => {
        if (exists) {
            console.error('Error: Release branch already exists. A release is already in progress.');
            process.exit(1);
        }
        return switchToBranchAndPull(git, 'develop');
    })
    .then(() => checkPackageJsonVersions())    
    .then(() => createReleaseBranch(git))
    .then(() => {
        // If version is specified, update package.json and/or lerna.json
        if (specifiedVersion) {
            console.log(`Setting version to ${specifiedVersion} in release branch`);
            const versionPromise = isLernaProject 
                ? changeLernaProjectVersion(specifiedVersion, 'release')
                : changePackageJsonVersion(specifiedVersion);
            return versionPromise;
        }
        return Promise.resolve();
    })
    .then(() => updateDistTagsDependencies(isLernaProject, version => version === 'dev', 'next'))
    .then(() => {
        const commitMessage = specifiedVersion 
            ? `chore: release start ${specifiedVersion}` 
            : 'chore: release start';
        return commitAndPush(git, 'release', commitMessage);
    })
    .then(() => {
        console.log("Summary of actions:");
        console.log("- A new release branch was created from develop");
        if (specifiedVersion) {
            console.log(`- Version was set to ${specifiedVersion} in the release branch`);
        }
        console.log("- Dependencies with 'dev' tag were updated to 'next'");
        console.log("- All changes were committed and pushed to remote");
        console.log("\nYou can now make changes to prepare for the release.");
        console.log("When you're ready to finish the release, run 'release-finish'.");
    });

/**
 * Checks package.json versions and dependencies
 * 
 * @returns {Promise<void>} A promise that resolves when the check is complete
 */
function checkPackageJsonVersions() {
    return new Promise((resolve) => {
        const packageLockJsonPath = path.resolve(process.cwd(), "package-lock.json");
        // First check package-lock.json
        fs.access(packageLockJsonPath, fs.constants.F_OK, (packageLockError) => {
            if (packageLockError) {
                // Then check npm-shrinkwrap.json
                const shrinkwrapPath = path.resolve(process.cwd(), "npm-shrinkwrap.json");
                fs.access(shrinkwrapPath, fs.constants.F_OK, (shrinkwrapError) => {
                    if (shrinkwrapError) {
                        // Finally check yarn.lock
                        const yarnLockJsonPath = path.resolve(process.cwd(), "yarn.lock");
                        fs.access(yarnLockJsonPath, fs.constants.F_OK, (yarnLockError) => {
                            if (yarnLockError) {
                                if (hasNotStableDependencies()) handleError("Not stable dependencies found. Please fix and try release again.");
                                resolve();
                            } else {
                                resolve();
                            }
                        });
                    } else {
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    });
}

/**
 * Checks if there are any non-stable dependencies in package.json
 * 
 * @returns {boolean} True if there are non-stable dependencies
 */
function hasNotStableDependencies() {
    let dependencies = Object.assign({}, packageJsonFile.dependencies || {}, packageJsonFile.devDependencies || {}, packageJsonFile.peerDependencies || {});
    let notStableDependencies;
    for (let property in dependencies) {
        const version = dependencies[property];
        if ((!version.match(/^\d+\.\d+\.\d/) || version.includes("dev")) && (!version.match(/^git:|^git\+https:|^git\+http:|^git\+ssh:|^git\+file:/))) {
            notStableDependencies = true;
            console.error("Not stable: " + property + ":" + version);
        }
    }
    return notStableDependencies;
}