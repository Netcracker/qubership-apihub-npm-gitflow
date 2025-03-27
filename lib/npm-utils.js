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

const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
const { handleError } = require('./git-utils');

/**
 * Changes package.json version using npm
 * 
 * @param {string} version - The new version
 * @returns {Promise<void>} A promise that resolves when version is changed
 */
function changePackageJsonVersion(version) {
    return new Promise((resolve) => {
        exec(`npm version ${version} --no-git-tag-version`, err => {
            handleError(err);
            console.log("Version of package.json changed to " + version);
            resolve();
        });
    });
}

/**
 * Changes lerna.json version
 * 
 * @param {string} version - The new version
 * @param {string} branchName - The branch name for allow-branch option
 * @returns {Promise<void>} A promise that resolves when version is changed
 */
function changeLernaProjectVersion(version, branchName = null) {
    return new Promise((resolve) => {
        const allowBranchOption = branchName ? `--allow-branch ${branchName}` : '';
        exec(`lerna version ${version} --no-push --no-private --no-git-tag-version ${allowBranchOption} --yes`, err => {
            handleError(err);
            console.log("Version of lerna.json changed to " + version);
            resolve();
        });
    });
}

/**
 * Updates dependencies with specific version pattern to a new version
 * 
 * @param {Object} packageJson - The package.json object
 * @param {Function} versionPredicate - Function that returns true if version should be updated
 * @param {string} newVersion - The new version to set
 * @returns {Array} List of updated packages
 */
function updateDistTagDependencies(packageJson, versionPredicate, newVersion) {
    const dependencyTypes = ['dependencies', 'devDependencies', 'peerDependencies'];
    let updatedPackages = [];
    
    dependencyTypes.forEach(type => {
        if (packageJson[type]) {
            Object.entries(packageJson[type]).forEach(([pkg, version]) => {
                if (versionPredicate(version)) {
                    packageJson[type][pkg] = newVersion;
                    console.log(`Updated ${pkg} from ${version} to ${newVersion} in ${type}`);
                    updatedPackages.push(pkg);
                }
            });
        }
    });
    
    return updatedPackages;
}

/**
 * Updates dependencies in the root package.json
 * 
 * @param {Function} versionPredicate - Function that returns true if version should be updated
 * @param {string} newVersion - The new version to set
 * @returns {Promise<Array>} Promise resolving to list of updated packages
 */
function updatePackageJsonDistTagDependencies(versionPredicate, newVersion) {
    return new Promise((resolve) => {
        const packageJsonPath = path.resolve(process.cwd(), "package.json");
        const packageJsonFile = require(packageJsonPath);
        
        const updatedPackages = updateDistTagDependencies(
            packageJsonFile,
            versionPredicate,
            newVersion
        );
        if (updatedPackages.length > 0) {
            fs.writeFile(packageJsonPath, JSON.stringify(packageJsonFile, null, 2), err => {
                if (err) throw err;
                console.log(`Updated dependencies matching predicate to ${newVersion}`);
                resolve(updatedPackages);
            });
        } else {
            resolve([]);
        }
    });
}

/**
 * Updates dependencies in all lerna packages
 * 
 * @param {Function} versionPredicate - Function that returns true if version should be updated
 * @param {string} newVersion - The new version to set
 * @returns {Promise<Array>} Promise resolving to list of updated packages
 */
function updateLernaPackagesDistTagDependencies(versionPredicate, newVersion) {
    return new Promise((resolve) => {
        exec('lerna list --json', (err, stdout) => {
            if (err) throw err;
            
            const packages = JSON.parse(stdout);
            let allUpdatedPackages = [];
            
            packages.forEach(pkg => {
                const packagePath = path.join(pkg.location, 'package.json');
                const packageJson = require(packagePath);
                
                const updatedPackages = updateDistTagDependencies(
                    packageJson,
                    versionPredicate,
                    newVersion
                );
                if (updatedPackages.length > 0) {
                    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
                    allUpdatedPackages = [...allUpdatedPackages, ...updatedPackages];
                }
            });
            
            if (allUpdatedPackages.length > 0) {
                console.log(`Updated dependencies matching predicate to ${newVersion} in all packages`);
            }
            resolve(allUpdatedPackages);
        });
    });
}

/**
 * Updates dist tags dependencies and lock files
 * 
 * @param {boolean} isLernaProject - Whether this is a lerna project
 * @param {Function} versionPredicate - Function that returns true if version should be updated
 * @param {string} newVersion - The new version to set
 * @returns {Promise<void>} Promise that resolves when updates are complete
 */
function updateDistTagsDependenciesAndLockFiles(isLernaProject, versionPredicate, newVersion) {
    return new Promise((resolve) => {
        console.log("Updating dist tags and lock files");
        
        // For lerna projects, update both root package.json and all packages
        const updatePromises = isLernaProject 
            ? [
                updatePackageJsonDistTagDependencies(versionPredicate, newVersion),
                updateLernaPackagesDistTagDependencies(versionPredicate, newVersion)
              ]
            : [updatePackageJsonDistTagDependencies(versionPredicate, newVersion)];
            
        Promise.all(updatePromises).then((results) => {
            // Flatten and combine all updated packages
            const updatedPackages = results.flat();
            console.log("Updated packages: ", updatedPackages);
            if (updatedPackages.length > 0) {
                const uniquePackages = [...new Set(updatedPackages)];
                exec(`npm update ${uniquePackages.join(' ')}`, (err) => {
                    if (err) throw err;
                    console.log("Updated lock files");
                    resolve();
                });
            } else {
                resolve();
            }
        });
    });
}

module.exports = {
    changePackageJsonVersion,
    changeLernaProjectVersion,
    updateDistTagsDependenciesAndLockFiles
}; 