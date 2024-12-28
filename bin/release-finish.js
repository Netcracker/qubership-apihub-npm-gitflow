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

let releaseBranch;
let version;

pullAll()
    .then(() => getCurrentBranchName())
    .then(branch => {
        if (branch.search("release") === -1) handleError("You are trying to release not release branch: " + branch);
        this.releaseBranch = branch;
        this.version = branch.match(/\d+\.\d+\.\d+/)[0];
    })
  .then(() => switchToBranch('main'))
    .then(() => mergeFromBranch(this.releaseBranch))
  .then(() => isLernaProject ? changeLernaProjectVersion(this.version, 'main') : changePackageJsonVersion(this.version))
    .then(() => commit(this.version))
    .then(() => createAndPushTag(this.version))
    .then(() => push())
    .then(() => switchToBranch("develop"))
    .then(() => mergeFromBranch(this.releaseBranch))
    .then(() => isLernaProject ? getIncrementedLernaVersion() : getIncrementedPackageJsonVersion())
    .then(incVersion => isLernaProject ? changeLernaProjectVersion(incVersion + "-develop.0", "develop") : changePackageJsonVersion(incVersion + "-develop.0"))
    .then(() => commit(this.version))
    .then(() => push())
    .then(() => deleteBranch(this.releaseBranch));

function pullAll() {
    return new Promise(resolve => {
        git.raw(["pull", "--all"], (err) => {
            handleError(err);
            console.log("Pull all branches");
            resolve();
        })
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
        git.raw(["merge", "--no-ff", branch], (err) => {
            handleError(err);
            console.log("Merge from branch! " + branch);
            resolve();
        })
    })
}

function changePackageJsonVersion(version) {
    return new Promise((resolve) => {
        packageJsonFile.version = version;
        fs.writeFile(packageJsonPath, JSON.stringify(packageJsonFile, null, 2), err => {
            handleError(err);
            console.log("Version of package.json changed to " + version);
            resolve();
        });
    });
}

function changeLernaProjectVersion(version, brunchName) {
    return new Promise((resolve) => {
        exec(`lerna version ${version} --no-push --no-git-tag-version --allow-branch ${brunchName} --yes`, err => {
            handleError(err);
            resolve();
        });
    });
}

function createAndPushTag(version) {
    return new Promise(resolve => {
        git.raw(["tag", "-a", version, "-m Release :" + version], (err) => {
            handleError(err);
            console.log("Git tag. Version: " + version);
        }).raw(["push", "origin", version], (err) => {
            handleError(err);
            console.log("Git push tags");
            resolve();
        })
    })
}

function commit(message) {
    return new Promise((resolve) => {
        git.raw(["commit", "-a", "--no-edit", "-m RE-42 Release: " + message], (err) => {
            handleError(err);
            console.log("Commit!");
            resolve();
        })
    });
}

function push() {
    return new Promise((resolve) => {
        git.raw(["push"], (err) => {
            handleError(err);
            console.log("Push!");
            resolve();
        })
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
        git.raw(["push", "origin", "--delete", branch], (err) => handleError(err))
            .branch(["-D", branch], (err) => {
                handleError(err);
                console.log("Branch " + branch + " was deleted!");
                resolve();
            });
    });
}

function handleError(err) {
    if (err) {
        console.log(err);
        process.exit(1);
    }
}
