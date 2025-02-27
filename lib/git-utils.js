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

/**
 * Checks if there are uncommitted changes in the working directory.
 * Fails the script with an error message if uncommitted changes are found.
 * 
 * @param {Object} git - The simple-git instance
 * @returns {Promise<void>} A promise that resolves if the working directory is clean
 */
function checkUncommittedChanges(git) {
    return new Promise((resolve, reject) => {
        git.status((err, status) => {
            if (err) {
                console.log(err);
                process.exit(1);
            }
            
            if (!status.isClean()) {
                console.error("Error: You have uncommitted changes in your working directory.");
                console.error("Please commit or stash your changes before proceeding.");
                process.exit(1);
            }
            
            console.log("Working directory is clean. Proceeding...");
            resolve();
        });
    });
}

module.exports = {
    checkUncommittedChanges
}; 