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
const semver = require('semver');
const { handleError } = require('./git-utils');
const { processLockFile } = require('./lock-file-utils');

/**
 * Changes package.json version using npm
 * 
 * @param {string} version - The new version
 * @returns {Promise<void>} A promise that resolves when version is changed
 */
function changePackageJsonVersion(version) {
    return new Promise((resolve) => {
        exec(`npm version ${version} --allow-same-version --no-git-tag-version`, err => {
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
        exec(`npx lerna version ${version} --force-publish --no-push --no-private --no-git-tag-version ${allowBranchOption} --yes`, err => {
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
 * @returns {Array} Array of updated packages
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
        exec('npx lerna list --json', (err, stdout) => {
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
 * Extracts scopes from a list of package names
 * 
 * @param {Array} packages - Array of package names
 * @returns {Array} Array of unique scopes
 */
function extractScopes(packages) {
    const scopes = new Set();
    
    packages.forEach(pkg => {
        if (pkg.startsWith('@')) {
            const scopePart = pkg.split('/')[0];
            scopes.add(scopePart);
        }
    });
    
    return [...scopes];
}

/**
 * Updates dist tags dependencies and optionally lock files
 * 
 * @param {boolean} isLernaProject - Whether this is a lerna project
 * @param {Function} versionPredicate - Function that returns true if version should be updated
 * @param {string} newVersion - The new version to set
 * @param {boolean} updateLockFile - Whether to update lock files (default: false)
 * @returns {Promise<void>} Promise that resolves when updates are complete
 */
function updateDistTagsDependencies(isLernaProject, versionPredicate, newVersion, updateLockFile = false) {
    return new Promise((resolve) => {
        console.log("Updating dist tags" + (updateLockFile ? " and lock files" : ""));
        
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
            const uniquePackages = [...new Set(updatedPackages)];
            
            console.log("Updated packages:", uniquePackages);
            
            if (uniquePackages.length > 0 && updateLockFile) {
                // Extract scopes from the updated packages
                const scopes = extractScopes(uniquePackages);
                console.log("Affected scopes:", scopes);
                
                if (scopes.length > 0) {
                    // Use processLockFile from lock-file-utils to update lock files for the affected scopes
                    processLockFile(scopes)
                        .then(() => {
                            console.log("Updated lock files for scopes:", scopes);
                            resolve();
                        })
                        .catch(err => {
                            handleError(err);
                            resolve();
                        });
                } else {
                    resolve();
                }
            } else {
                resolve();
            }
        });
    });
}

/**
 * Returns the version core (Major.Minor.Patch) from the provided version
 * Returns null if the version is not valid
 * 
 * @param {string} version - The current version
 * @returns {string|null} The version core or null if invalid
 */
function getVersionCore(version) {
    const parsedVersion = semver.parse(version);
    if (!parsedVersion) {
        return null;
    }
    return `${parsedVersion.major}.${parsedVersion.minor}.${parsedVersion.patch}`;
}

/**
 * Returns the version core with the patch version incremented by 1.
 * Returns null if the version is not valid
 * 
 * @param {string} version - The current version
 * @returns {string|null} The incremented patch version or null if invalid
 */
function getIncrementedPatchVersion(version) {
    const versionCore = getVersionCore(version);
    if (!versionCore) {
        return null;
    }
    return semver.inc(versionCore, 'patch');
}

module.exports = {
    changePackageJsonVersion,
    changeLernaProjectVersion,
    updateDistTagsDependencies,
    getIncrementedPatchVersion,
    getVersionCore
}; 