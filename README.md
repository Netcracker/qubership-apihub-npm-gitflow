# NPM Git Flow
Automate most common gitflow process steps for NPM repositories
## Features
Manages git branches according to [gitflow](https://nvie.com/posts/a-successful-git-branching-model/).

Updates version for NPM and Lerna projects.
## Usage
Add as dev dependency to you project.

Use in a console or as a part of CI process.
```shell
feature-start <feature-name>
```
```shell
feature-finish [--squash|-s] [--message|-m "Custom commit message"]
```
```shell
bugfix-start <bugfix-name>
```
```shell
bugfix-finish [--squash|-s] [--message|-m "Custom commit message"]
```
```shell
release-start [version]
```
```shell
release-finish
```
```shell
hotfix-start
```
```shell
hotfix-finish
```
```shell
update-lock-file <scope>
```

## Feature and Bugfix Commands
### `feature-start <feature-name>`
Creates a new feature branch from develop

### `feature-finish [--squash|-s] [--message|-m "Custom commit message"]`
Merges feature branch back to develop. 

[Dist-tag](https://docs.npmjs.com/adding-dist-tags-to-packages) dependencies to tags starting with `feature`/`bugfix` are replaced to `dev` dist-tag dependencies in `package.json` file. 

Lock file is not updated in development branches to reduce merge conflicts (assumed to be auto-update by CI or updated manually locally for development branches).
### `bugfix-start <bugfix-name>`
Creates a new bugfix branch from develop
### `bugfix-finish [--squash|-s] [--message|-m "Custom commit message"]`
Merges bugfix branch back to develop.

[Dist-tag](https://docs.npmjs.com/adding-dist-tags-to-packages) dependencies to tags starting with `feature`/`bugfix` are replaced to `dev` dist-tag dependencies in `package.json` file. 

Lock file is not updated in development branches to reduce merge conflicts (assumed to be auto-update by CI or updated manually locally for development branches).

## Release Commands
### `release-start [version]`
Creates a release branch from develop and optionally sets version. If a version is not specified- version core from develop branch will be used. If necessary, you can change release version in the `release` branch during release process.

[Dist-tag](https://docs.npmjs.com/adding-dist-tags-to-packages) dependencies to `dev` tag are replaced to `next` dist-tag dependencies in `package.json` file. 

Lock file is not updated in development branches to reduce merge conflicts (assumed to be auto-update by CI or updated manually locally for development branches).
### `release-finish`
Merges release branch to main and back to develop

## Hotfix Commands
### `hotfix-start`
Creates a hotfix branch from main and increments the patch version
### `hotfix-finish`
Merges hotfix branch to main and back to develop

## Lock File Utilities
### `update-lock-file <scope>`
Updates dependencies in lock files (`package-lock.json` or `npm-shrinkwrap.json`) for the specified [npm scope](https://docs.npmjs.com/about-scopes)
  - `<scope>`: The npm scope to update (e.g. '@company')