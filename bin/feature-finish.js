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
const exec = require('child_process').exec;

const path = require('path');
const isLernaProject = fs.existsSync("./lerna.json");
const { updateDistTagsDependenciesAndLockFiles } = require('../lib/update-dist-tags');

let featureBranch;

getCurrentBranchName()
    .then(branch => {
        if (branch.search("feature") === -1) handleError("You are trying to finish not feature branch: " + branch);
        this.featureBranch = branch;
    })
    .then(() => updateFeatureBranchToDevelop())
    .then(() => switchToDevelopAndPull())
    .then(() => mergeToDevelop(this.featureBranch))
    .then(() => getDevelopVersion())
    .then((version) => isLernaProject ? changeLernaVersion(version) : changePackageJsonVersion(version))
    .then(() => updateDistTagsDependenciesAndLockFiles(isLernaProject, version => version.startsWith('feature'), 'dev'))
    .then(() => commitAndPush(this.featureBranch))
    .then(() => deleteFeatureBranch(this.featureBranch));

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

function updateFeatureBranchToDevelop() {
    return new Promise(resolve => {
        git.pull('origin', 'develop', ['--no-rebase', '--progress', '-v'])
            .then(() => {
                resolve();
            })
            .catch(handleError);
    });
}

function switchToDevelopAndPull() {
    return new Promise(resolve => {
        git.checkout("develop")
            .pull((err) => {
                handleError(err);
                console.log("Switch to develop and update!");
                resolve();
            })
    })
}

function mergeToDevelop(branch) {
    return new Promise(resolve => {
        git.mergeFromTo(branch, "develop", ["--no-edit", "--no-commit", "--no-ff"], (err) => {
            handleError(err);
            console.log("Merge from " + branch + " to develop. You are now at develop.");
            resolve();
        })
    });
}

function getDevelopVersion() {
    return new Promise((resolve) => {
        git.show([isLernaProject ? "develop:lerna.json" : "develop:package.json"], (err, data) => {
            handleError(err);
            let version = JSON.parse(data)["version"];
            console.log("Develop version: " + version);
            resolve(version);
        })
    });
}

function changePackageJsonVersion(version) {
    return new Promise((resolve) => {
        executeCommand("npm version --no-git-tag-version " + version).then(() => {
            console.log("Version of package.json changed to " + version);
            resolve();
        });
    });
}

function changeLernaVersion(version) {
    return new Promise((resolve) => {
        exec(`lerna version ${version} --no-push --no-private --no-git-tag-version --yes`, err => {
            handleError(err);
            resolve();
        });
    });
}

function commitAndPush(branch) {
    return new Promise((resolve) => {
        git.commit('chore: merge from ' + branch + ' to develop', ['--all', '--no-edit'])
            .then(() => {
                console.log("Commit!");
                return git.push('origin', 'develop');
            })
            .then(() => {
                console.log("Push!");
                resolve();
            })
            .catch(handleError);
    });
}

function deleteFeatureBranch(branch) {
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

function executeCommand(command) {
    return new Promise((resolve) => {
        exec(command, err => {
            handleError(err);
            resolve();
        });
    });
}
