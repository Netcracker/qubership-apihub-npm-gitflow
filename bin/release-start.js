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
    createReleaseBranch, 
    commitAndPush,
    handleError,
    checkRemoteBranchExists
} = require('../lib/git-utils');
const { 
    updateDistTagsDependenciesAndLockFiles 
} = require('../lib/npm-utils');

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
    .then(() => updateDistTagsDependenciesAndLockFiles(isLernaProject, version => version === 'dev', 'next'))
    .then(() => commitAndPush(git, 'release', 'chore: release start'));

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