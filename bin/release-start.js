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
const isLernaProject = fs.existsSync("./lerna.json");

const packageJsonPath = path.resolve(process.cwd(), "package.json");
const packageJsonFile = require(packageJsonPath);

let releaseVersion;

//TODO: add check that release is already in progress
switchToDevelopAndPull()
    .then(() => checkPackageJsonVersions())
    .then(() => isLernaProject ? getLernaVersion() : getPackageJsonVersion())
    .then(releaseVersion => this.releaseVersion = releaseVersion + '-next.0')
    .then(() => createReleaseBranch(this.releaseVersion))
    .then(() => isLernaProject ? changeLernaProjectVersion(this.releaseVersion) : changePackageJsonVersion(this.releaseVersion))
    .then(() => commitAndPushRelease(this.releaseVersion));

function switchToDevelopAndPull() {
    return new Promise(resolve => {
        git.checkout('develop')
            .pull((err) => {
                handleError(err);
                console.log("Switch to develop and update!");
                resolve();
            })
    })
}

function getPackageJsonVersion() {
    return new Promise((resolve) => {
        resolve(packageJsonFile.version.match(/\d+\.\d+\.\d+/)[0]);
    });
}

function getLernaVersion() {
    return new Promise((resolve) => {
        resolve(require(path.resolve(process.cwd(), "lerna.json")).version.match(/\d+\.\d+\.\d+/)[0]);
    });
}

function createReleaseBranch(releaseVersion) {
    return new Promise(resolve => {
        git.raw(["checkout", "-b", "release", "develop"], err => {
            handleError(err);
            console.log("Create release branch with version: " + releaseVersion);
            resolve();
        })
    })
}

function changePackageJsonVersion(version) {
    return new Promise((resolve) => {
        packageJsonFile.version = version;
        //TODO: use npm to set version
        fs.writeFile(packageJsonPath, JSON.stringify(packageJsonFile, null, 2), err => {
            handleError(err);
            console.log("Version of package.json changed to " + version);
            resolve();
        });
    });
}

function changeLernaProjectVersion(version) {
    return new Promise((resolve) => {
        exec(`lerna version ${version} --no-push --no-private --no-git-tag-version --allow-branch release --yes`, err => {
            handleError(err);
            resolve();
        });
    });
}

function commitAndPushRelease(releaseVersion) {
    return new Promise((resolve) => {
        git.raw(["commit", "-a", "--no-edit", "-m chore: release start, version: " + releaseVersion], (err) => {
            handleError(err);
            console.log("Commit!")
        }).raw(["push", "--set-upstream", "origin", "release"], (err) => {
            handleError(err);
            console.log("Push!");
            resolve();
        });
    });
}

function checkPackageJsonVersions() {
    return new Promise((resolve) => {
        const packageLockJsonPath = path.resolve(process.cwd(), "package-lock.json");
        fs.access(packageLockJsonPath, fs.constants.F_OK, (packageLockError) => {
            if (packageLockError) {
                const yarnLockJsonPath = path.resolve(process.cwd(), "yarn.lock");
                fs.access(yarnLockJsonPath, fs.constants.F_OK, (yarnLockError) => {
                    if (yarnLockError) {
                        if (hasNotStableDependencies()) handleError("Not stable dependencies found. Please fix and try release again.");
                        resolve();
                    } else {
                        resolve();
                    }
                })
            } else {
                resolve();
            }
        })
    });
}

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

    return notStableDependencies
}

function handleError(err) {
    if (err) {
        console.log(err);
        process.exit(1);
    }
}
