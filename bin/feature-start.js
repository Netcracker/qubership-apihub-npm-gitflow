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
const exec = require('child_process').exec;
const git = require('simple-git')();
const fs = require('fs');

const debug = require('debug');
debug.enable('simple-git');

const optionDefinitions = [
    {name: 'featureName', alias: 'f', type: String, defaultOption: true}
];

const options = commandLineArgs(optionDefinitions);

const featureName = options.featureName;
const isLernaProject = fs.existsSync("./lerna.json");

if (!featureName || typeof featureName === "boolean") {
    console.log("Feature name must not be empty!");
    process.exit(0);
}

let featureVersion;

switchToDevelopAndPull()
    .then(() => createFeatureBranch(featureName))
    .then(() => getFeatureVersion(isLernaProject))
    .then(version => featureVersion = version)
    .then(() => isLernaProject ? changeLernaProjectVersion(featureVersion) : changePackageJsonVersion(featureVersion))    
    .then(() => commitAndPush(featureName, featureVersion))
    .then(() => printSummary(featureName, featureVersion));

function switchToDevelopAndPull() {
    return new Promise(resolve => {
        git.pull((err) => handleError(err))
            .checkout("develop", (err) => {
                handleError(err);
                console.log("Switch to develop and update!");
                resolve();
            });
    });
}

function createFeatureBranch(featureName) {
    return new Promise(resolve => {
        git.checkoutLocalBranch("feature/" + featureName, (err) => {
            handleError(err);
            console.log("Created feature branch: feature/" + featureName);
            resolve();
        });
    });
}

function getFeatureVersion(isLernaProject) {
    return new Promise(resolve => {
        git.show([isLernaProject ? "develop:lerna.json" : "develop:package.json"], (err, data) => {
            handleError(err);
            const developVersion = JSON.parse(data)["version"];
            const baseVersion = developVersion.match(/\d+\.\d+\.\d+/)[0];
            const featureVersion = baseVersion + "-feature-" + featureName + ".0";
            resolve(featureVersion);
        });
    });
}

function changePackageJsonVersion(version) {
    return new Promise((resolve) => {
        exec(`npm version ${version} --no-git-tag-version`, err => {
            handleError(err);
            console.log("Version of package.json changed to " + version);
            resolve();
        });
    });
}

function changeLernaProjectVersion(version) {
    return new Promise((resolve) => {
        exec(`lerna version ${version} --no-push --no-private --no-git-tag-version --yes`, err => {
            handleError(err);
            console.log("Version of lerna.json changed to " + version);
            resolve();
        });
    });
}

function commitAndPush(featureName, featureVersion) {
    return new Promise((resolve) => {
        git.commit('chore: update version to ' + featureVersion, ['--all', '--no-edit'])
            .then(() => {
                console.log("Commit!");
                return git.push('origin', 'feature/' + featureName, ['--set-upstream']);
            })
            .then(() => {
                console.log("Push!");
                resolve();
            })
            .catch(handleError);
    });
}

function printSummary(featureName, featureVersion) {
    console.log("Summary of actions: ");
    console.log("A new branch feature/" + featureName + " was created, based on 'develop'");
    console.log("You are now on branch feature/" + featureName);
    console.log("Feature version now: " + featureVersion);
}

function handleError(err) {
    if (err) {
        console.log(err);
        process.exit(1);
    }
}
