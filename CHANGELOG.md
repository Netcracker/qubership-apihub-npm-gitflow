## 2.2.2

### Fixed
- adapt GitHub workflow to publish from git tag

## 2.2.1

### Fixed
- check for npm-shrinkwrap file in addition to package lock when validating dependencies during release start

## 2.2.0

### Added
- replace 'dev' dependencies versions to 'next' during release start
- replace 'feature-..' dependencies versions to 'dev' during feature finish
- dependency validation during feature finish

### Fixed
- commit changed versions after feature start

## 2.1.0
- use release branch without version in name
- merge updated version to develop from main during release
- commit bumped version in lerna projects
- do not update version for private packages in lerna repositories

## 2.0.0
- change commit messages to conform to [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
- remove git tag creation for `feature` branches
- add prerelease suffixes for package version in `release` and `feature` branches
- BREAKING CHANGE: single `release` branch assumed
- BREAKING CHANGE: package version prerelease suffix changed to `-dev` for `develop` branche

## 1.0.12 - 2024-03-01

### New

- check yarn.lock file on release-start

## 1.0.11 - 2023-04-27

### Fixed

- support build reproduce by package-lock.json

## 1.0.10 - 2020-10-01

### Fixed

- add more patterns for dependencies check

## 1.0.9 - 2019-06-24

### Fixed

- add allow-branch for lerna version commands

## 1.0.8 - 2019-06-24
### Fixed
- add missed import to scripts

## 1.0.7 - 2019-06-24
### New
- support lerna projects

## 1.0.6
### Fixed

- add ticket prefix to all commit messages

## 1.0.5 - 2018-11-29
### Fixed
- fix release date suffix in TAG

## 1.0.4 - 2018-11-29
### Fixed
- fix publish-local command

## 1.0.3 - 2018-09-19
### Fixed
- _feature-start_ now call feature start

## 1.0.2 - 2018-09-19
### Fixed

- add _no-ff_ to release-finish to make main branch parallel to develop

## 1.0.1 - 2018-09-18
### Fixed
- After _release-start_ script all devDependencies move to dependencies section.

## 1.0.0 - 2018-09-17
### Initial Version
  