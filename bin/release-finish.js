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
const exec = require('child_process').exec;
const path = require('path');
const packageJsonPath = path.resolve(process.cwd(), "package.json");
const packageJsonFile = require(packageJsonPath);
const isLernaProject = fs.existsSync("./lerna.json");
const { checkUncommittedChanges } = require('../lib/git-utils');

let releaseBranch;
let version;

checkUncommittedChanges(git)
    .then(() => pullAll())
    .then(() => switchToBranch('release'))
    .then(() => validateDependencies())
    .then(() => {
        //Get version in release branch
        git.show([isLernaProject ? "release:lerna.json" : "release:package.json"], (err, data) => {
            handleError(err);
            this.version = JSON.parse(data)["version"].match(/\d+\.\d+\.\d+/)[0]
            this.releaseBranch = 'release'        
        })
    })    
    .then(() => switchToBranch('main'))
    .then(() => mergeFromBranch(this.releaseBranch))
    .then(() => isLernaProject ? changeLernaProjectVersion(this.version, 'main') : changePackageJsonVersion(this.version))
    .then(() => commit(this.version))
    .then(() => createAndPushTag(this.version))
    .then(() => push())
    .then(() => switchToBranch("develop"))
    .then(() => mergeFromBranch('main'))
    .then(() => isLernaProject ? getIncrementedLernaVersion() : getIncrementedPackageJsonVersion())
    .then(incVersion => isLernaProject ? changeLernaProjectVersion(incVersion + "-dev.0", "develop") : changePackageJsonVersion(incVersion + "-dev.0"))
    .then(() => commit(this.version))
    .then(() => push())
    .then(() => deleteBranch(this.releaseBranch));

function pullAll() {
    return new Promise(resolve => {
        git.pull(['--all'])
            .then(() => {
                console.log("Pull all branches");
                resolve();
            })
            .catch(handleError);
    });
}

function getCurrentBranchName() {
    return new Promise(resolve => {
        git.branch((err, data) => {
            handleError(err);
            let branch = data["current"];
            console.log("Current branch: " + branch);
            resolve(branch);
        })
    });
}

function switchToBranch(branch) {
    return new Promise(resolve => {
        git.checkout(branch, (err) => {
            handleError(err);
            console.log("Switch to " + branch + "!");
            resolve();
        })
    })
}

function mergeFromBranch(branch) {
    return new Promise(resolve => {
        git.merge(['--no-ff', branch])
            .then(() => {
                console.log("Merge from branch! " + branch);
                resolve();
            })
            .catch(handleError);
    });
}

function changePackageJsonVersion(version) {
    return new Promise((resolve) => {
        //TODO: use npm to set version
        packageJsonFile.version = version;
        fs.writeFile(packageJsonPath, JSON.stringify(packageJsonFile, null, 2), err => {
            handleError(err);
            console.log("Version of package.json changed to " + version);
            resolve();
        });
    });
}

function changeLernaProjectVersion(version, branchName) {
    return new Promise((resolve) => {
        exec(`lerna version ${version} --no-push --no-private --no-git-tag-version --allow-branch ${branchName} --yes`, err => {
            handleError(err);
            resolve();
        });
    });
}

function createAndPushTag(version) {
    return new Promise(resolve => {
        git.addAnnotatedTag(version, 'chore: release :' + version)
            .then(() => git.pushTags())
            .then(() => {
                console.log("Git tag. Version: " + version);
                console.log("Git push tags");
                resolve();
            })
            .catch(handleError);
    });
}

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

function push() {
    return new Promise((resolve) => {
        git.push()
            .then(() => {
                console.log("Push!");
                resolve();
            })
            .catch(handleError);
    });
}

function getIncrementedLernaVersion() {
    return new Promise((resolve) => {
        const lernaFile = require(path.resolve(process.cwd(), "lerna.json"));
        let version = lernaFile.version.match(/\d+\.\d+\.\d+/)[0];
        let incrementedVersion = version.replace(/\d+$/, (n) => ++n);
        resolve(incrementedVersion);
    });
}

function getIncrementedPackageJsonVersion() {
    return new Promise((resolve) => {
        let version = packageJsonFile.version.match(/\d+\.\d+\.\d+/)[0];
        let incrementedVersion = version.replace(/\d+$/, (n) => ++n);
        resolve(incrementedVersion);
    });
}

function deleteBranch(branch) {
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

function handleError(err) {
    if (err) {
        console.log(err);
        process.exit(1);
    }
}

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
