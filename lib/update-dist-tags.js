const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;

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
    updateDistTagsDependenciesAndLockFiles
}; 