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
const {
    checkUncommittedChanges,
    switchToBranchAndPull,
    createFeatureBranch,    
    pushNewBranch
} = require('../lib/git-utils');

const optionDefinitions = [
    {name: 'featureName', alias: 'f', type: String, defaultOption: true}
];

const options = commandLineArgs(optionDefinitions);

const featureName = options.featureName;

if (!featureName || typeof featureName === "boolean") {
    console.log("Feature name must not be empty!");
    process.exit(0);
}

checkUncommittedChanges(git)
    .then(() => switchToBranchAndPull(git, 'develop'))
    .then(() => createFeatureBranch(git, featureName))    
    .then(() => pushNewBranch(git, 'feature/' + featureName))
    .then(() => printSummary(featureName));

function printSummary(featureName) {
    console.log("Summary of actions: ");
    console.log("A new branch feature/" + featureName + " was created, based on 'develop'");
    console.log("You are now on branch feature/" + featureName);
}