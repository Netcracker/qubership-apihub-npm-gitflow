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

const path = require('path');
const semver = require('semver');
const packageJsonPath = path.resolve(process.cwd(), "package.json");
const { handleError } = require('./git-utils');

/**
 * Validates that all dependencies are using versions allowed for the specific branch type
 * 
 * @param {string} targetBranchType - The type of branch ('main', 'release', 'hotfix', 'develop', 'feature', 'bugfix')
 * @param {Set<string>} excludePackages - Set of package names to exclude from validation
 * @returns {Promise<void>} A promise that resolves when validation is complete
 */
function validateDependencies(targetBranchType = 'main', excludePackages = new Set()) {
    return new Promise((resolve) => {
        const packageJson = require(packageJsonPath);
        
        const dependencies = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
            ...packageJson.peerDependencies
        };

        const invalidDeps = [];
        
        for (const [dep, version] of Object.entries(dependencies)) {
            // Skip validation for excluded packages
            if (excludePackages.has(dep)) {
                continue;
            }
            
            if (typeof version === 'string') {
                if (!isVersionAllowed(version, targetBranchType)) {
                    invalidDeps.push(`${dep}@${version}`);
                }
            }
        }

        if (invalidDeps.length > 0) {
            const errorMessage = `Cannot proceed with ${targetBranchType} branch type rules. The following dependencies must be updated to allowed versions:\n` + 
                               invalidDeps.map(dep => `  - ${dep}`).join('\n');
            handleError(new Error(errorMessage));
        }
        
        console.log(`Dependencies validation passed for ${targetBranchType} branch type rules`);
        resolve();
    });
}

/**
 * Determines if a version is allowed for the specific branch type
 * 
 * @param {string} version - The version string to check
 * @param {string} targetBranchType - The type of branch
 * @returns {boolean} Whether the version is allowed
 */
function isVersionAllowed(version, targetBranchType) {
    // Release versions are allowed in all branches
    if (isReleaseVersion(version)) {
        return true;
    }
    
    // Get allowed tags for the branch type
    const allowedTags = getAllowedTags(targetBranchType);
    
    // Check if version is one of the allowed tags for this branch
    if (allowedTags.exactTags.includes(version)) {
        return true;
    }
    
    // Check if version starts with one of the allowed tag prefixes
    return allowedTags.prefixTags.some(prefix => version.startsWith(prefix));
}

/**
 * Checks if the version is a release version using semver library
 * Excludes pre-release versions and versions with build metadata
 * 
 * @param {string} version - The version string to check
 * @returns {boolean} Whether the version is a release version
 */
function isReleaseVersion(version) {
    try {
        // Check if it's a valid semver range (caret, tilde, hyphen, or inequality)
        const range = new semver.Range(version);
        
        // For ranges, we need to check each comparator
        for (const comparator of range.set[0]) {
            const comparatorVersion = comparator.semver;
            
            // Check if any version in the range has pre-release or build metadata
            if (comparatorVersion.prerelease.length > 0 || comparatorVersion.build.length > 0) {
                return false;
            }
        }
        
        return true;
    } catch (e) {
        // If it's not a range, check if it's a valid version
        if (semver.valid(version)) {
            const parsedVersion = semver.parse(version);
            return parsedVersion.prerelease.length === 0 && parsedVersion.build.length === 0;
        }
        
        return false;
    }
}

/**
 * Gets the allowed tags for a specific branch type
 * 
 * @param {string} targetBranchType - The type of branch
 * @returns {object} Object containing exactTags and prefixTags
 */
function getAllowedTags(targetBranchType) {
    const allowedTags = {
        exactTags: [],
        prefixTags: []
    };
    
    switch (targetBranchType) {
        case 'release':
            allowedTags.exactTags.push('next');
            break;
        case 'hotfix':
            allowedTags.exactTags.push('hotfix');
            break;
        case 'develop':
            allowedTags.exactTags.push('dev');
            break;
        case 'feature':
            allowedTags.exactTags.push('dev');
            allowedTags.prefixTags.push('feature');
            break;
        case 'bugfix':
            allowedTags.exactTags.push('dev');
            allowedTags.prefixTags.push('bugfix');
            break;
        case 'main':
        default:
            // No additional tags allowed for main
            break;
    }
    
    return allowedTags;
}

module.exports = {
    validateDependencies
}; 