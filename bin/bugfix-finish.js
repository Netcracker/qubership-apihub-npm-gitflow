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
const { finishTopicBranch } = require('../lib/topic-branch-scripts');

const optionDefinitions = [
    { name: 'squash', alias: 's', type: Boolean, defaultValue: false },
    { name: 'message', alias: 'm', type: String }
];

const options = commandLineArgs(optionDefinitions);

finishTopicBranch(git, 'bugfix', options.squash, options.message); 