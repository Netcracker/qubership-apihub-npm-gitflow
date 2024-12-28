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

let developVersion;
let featureVersion;

git
//Update develop before creating new feature branch
    .pull((err) => handleError(err))
    //Creating feature branch
    .checkout("develop", (err) => handleError(err))
    .checkoutLocalBranch("feature/" + featureName, (err) => handleError(err))
    //Get develop version
    .show([isLernaProject ? "develop:lerna.json" : "develop:package.json"], (err, data) => {
        handleError(err);
        developVersion = JSON.parse(data)["version"];
        featureVersion = developVersion + "-" + featureName;
    })
    //Change version at feature branch (autocommit)
    .exec(() => {
        let execPromise;
        if (isLernaProject) {
            console.log("Update versions for lerna project");
            execPromise = executeCommand(`lerna version ${featureVersion} --message \"RE-42 update version to ${featureVersion}\" --no-push --yes`);
        } else {
            console.log("Update versions for project");
            execPromise = executeCommand("npm version -m \"RE-42 update version to " + featureVersion + "\" " + featureVersion);
        }
        execPromise.then(() => {
            git  //Push
                .push(["origin", "feature/" + featureName], (err) => {
                    handleError(err);
                }) //Set upstream branch
                .branch(["--set-upstream-to", "origin/feature/" + featureName, "feature/" + featureName], (err) => {
                    handleError(err);
                    printSummary();
                });
        });
    });

function executeCommand(command) {
    return new Promise((resolve) => {
        exec(command, err => {
            handleError(err);
            resolve();
        });
    });
}

function printSummary() {
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
