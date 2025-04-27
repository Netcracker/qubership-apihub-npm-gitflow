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
const { exec } = require('child_process');

/**
 * Validates the npm scope format
 * 
 * @param {string|string[]} scope - The npm scope(s) to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateScope(scope) {
    // Handle array of scopes
    if (Array.isArray(scope)) {
        if (scope.length === 0) {
            console.log("Scopes array must not be empty! Please provide npm scopes (e.g. ['@company'])");
            return false;
        }
        
        // Validate each scope in the array
        for (const s of scope) {
            if (!validateSingleScope(s)) {
                return false;
            }
        }
        return true;
    }
    
    // Handle single scope
    return validateSingleScope(scope);
}

/**
 * Validates a single npm scope format
 * 
 * @param {string} scope - The npm scope to validate
 * @returns {boolean} True if valid, false otherwise
 * @private
 */
function validateSingleScope(scope) {
    if (!scope || typeof scope === "boolean") {
        console.log("Scope must not be empty! Please provide an npm scope (e.g. '@company')");
        return false;
    }

    // Validate the scope format
    if (!scope.startsWith('@') || scope.includes('/')) {
        console.log(`Invalid scope format: ${scope}. It should start with '@' and not contain '/' (e.g. '@company')`);
        return false;
    }
    
    return true;
}

/**
 * Collects package names with the specified scope(s) from package.json
 * 
 * @param {string|string[]} scope - The npm scope(s) to look for
 * @returns {Array} List of full package names with the specified scope(s)
 */
function collectScopePackages(scope) {
    const packages = new Set();
    const scopes = Array.isArray(scope) ? scope : [scope];
    
    try {
        const packageJsonPath = path.resolve(process.cwd(), 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        // Check dependencies, devDependencies, and peerDependencies
        ['dependencies', 'devDependencies', 'peerDependencies'].forEach(depType => {
            if (packageJson[depType]) {
                Object.keys(packageJson[depType]).forEach(depName => {
                    for (const s of scopes) {
                        if (depName.startsWith(s)) {
                            packages.add(depName);
                            break;
                        }
                    }
                });
            }
        });
    } catch (error) {
        console.error('Error reading package.json:', error);
        throw error;
    }
    
    return Array.from(packages);
}

/**
 * Processes the package lock file and updates packages with the specified scope(s)
 * 
 * @param {string|string[]} scope - The npm scope(s) to look for (e.g. '@company' or ['@company', '@org'])
 * @returns {Promise<void>} A promise that resolves when processing is complete
 */
async function processLockFile(scope) {
    try {
        const scopes = Array.isArray(scope) ? scope : [scope];
        const lockFilePath = getLockFilePath();
        console.log(`Processing ${path.basename(lockFilePath)}...`);
        
        // Get packages with the specified scope(s) from package.json
        const packagesToUpdate = collectScopePackages(scopes);
        
        if (packagesToUpdate.length === 0) {
            const scopesStr = scopes.join(', ');
            console.log(`No packages found with scope(s) ${scopesStr}`);
            return;
        }
        
        const scopesStr = scopes.join(', ');
        console.log(`Found ${packagesToUpdate.length} packages with scope(s) ${scopesStr}: ${packagesToUpdate.join(' ')}`);        
        
        // Read and update lock file
        const lockFileContent = fs.readFileSync(lockFilePath, 'utf8');
        const lockFileData = JSON.parse(lockFileContent);
        
        // Remove node_modules entries
        const updatedLockFileData = removeNodeModulesEntries(lockFileData, scopes);
        
        // Write the updated lock file
        fs.writeFileSync(lockFilePath, JSON.stringify(updatedLockFileData, null, 2));
        console.log(`Updated ${path.basename(lockFilePath)} - removed node_modules entries for scope(s) ${scopesStr}`);
        
        // Update packages
        await updatePackages(packagesToUpdate);
        
        console.log('Process completed successfully');
    } catch (error) {
        console.error('Error processing lock file:', error);
        throw error;
    }
}

/**
 * Determines the correct lock file to use (package-lock.json or npm-shrinkwrap.json)
 * 
 * @returns {string} Path to the lock file
 */
function getLockFilePath() {
    const packageLockPath = path.resolve(process.cwd(), 'package-lock.json');
    const shrinkwrapPath = path.resolve(process.cwd(), 'npm-shrinkwrap.json');
    
    if (fs.existsSync(packageLockPath)) {
        return packageLockPath;
    } else if (fs.existsSync(shrinkwrapPath)) {
        return shrinkwrapPath;
    } else {
        throw new Error('No package-lock.json or npm-shrinkwrap.json found in the root directory');
    }
}

/**
 * Removes entries starting with 'node_modules/<scope>' from the lock file
 * 
 * @param {Object} lockFileData - The parsed lock file data
 * @param {string|string[]} scope - The npm scope(s) to look for
 * @returns {Object} Updated lock file data
 */
function removeNodeModulesEntries(lockFileData, scope) {
    const result = { ...lockFileData };
    const scopes = Array.isArray(scope) ? scope : [scope];
    
    if (result.packages) {
        // Create a new packages object with the filtered entries
        const filteredPackages = {};
        
        Object.keys(result.packages).forEach(pkgPath => {
            let shouldKeep = true;
            
            for (const s of scopes) {
                const nodeModulesScopePrefix = `node_modules/${s}`;
                if (pkgPath.startsWith(nodeModulesScopePrefix)) {
                    shouldKeep = false;
                    break;
                }
            }
            
            if (shouldKeep) {
                filteredPackages[pkgPath] = result.packages[pkgPath];
            }
        });
        
        result.packages = filteredPackages;
    }
    
    return result;
}

/**
 * Updates the specified packages using npm update
 * 
 * @param {Array} packages - List of package names to update
 * @returns {Promise<void>} A promise that resolves when updates are complete
 */
function updatePackages(packages) {
    return new Promise((resolve, reject) => {
        if (packages.length === 0) {
            resolve();
            return;
        }
        
        const updateCommand = `npm update ${packages.join(' ')}`;
        console.log(`Running: ${updateCommand}`);
        
        exec(updateCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error updating packages: ${error.message}`);
                reject(error);
                return;
            }
            
            if (stdout) console.log(stdout);
            if (stderr) console.error(stderr);
            
            console.log('Packages updated successfully');
            resolve();
        });
    });
}

module.exports = {
    validateScope,
    collectScopePackages,
    processLockFile,
    getLockFilePath,
    removeNodeModulesEntries,
    updatePackages
}; 