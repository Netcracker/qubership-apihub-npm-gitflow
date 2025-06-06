# NPM Git Flow
Automate most common gitflow process steps for NPM repositories
## Features
Manages git branches according to [gitflow](https://nvie.com/posts/a-successful-git-branching-model/).

Updates version for NPM and Lerna projects.
## Usage
Add as dev dependency to you project.

Use in a console or as a part of CI process.
```shell
npx feature-start <feature-name>
```
```shell
npx feature-finish [--squash|-s] [--message|-m "Custom commit message"]
```
```shell
npx bugfix-start <bugfix-name>
```
```shell
npx bugfix-finish [--squash|-s] [--message|-m "Custom commit message"]
```
```shell
npx release-start [version]
```
```shell
npx release-finish
```
```shell
npx hotfix-start
```
```shell
npx hotfix-finish
```
```shell
npx update-lock-file <scope>
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
### `release-finish [--no-version-check <package1> [<package2> ...]]`
Merges release branch to main and back to develop.

The `--no-version-check` argument allows you to specify a list of packages that should be excluded from version validation. This is useful for packages that follow eternal alpha/beta approach (e.g. '@mui/lab'). If specified, at least one package must be provided.

Example:
```shell
npx release-finish --no-version-check @mui/lab
```

## Hotfix Commands
### `hotfix-start`
Creates a hotfix branch from main and increments the patch version
### `hotfix-finish [--no-version-check <package1> [<package2> ...]]`
Merges hotfix branch to main and back to develop.

The `--no-version-check` argument allows you to specify a list of packages that should be excluded from version validation. This is useful for packages that follow eternal alpha/beta approach (e.g. '@mui/lab'). If specified, at least one package must be provided.

Example:
```shell
npx hotfix-finish --no-version-check @mui/lab
```

## Lock File Utilities
### `update-lock-file <scope>`
Updates dependencies in lock files (`package-lock.json` or `npm-shrinkwrap.json`) for the specified [npm scope](https://docs.npmjs.com/about-scopes)
  - `<scope>`: The npm scope to update (e.g. '@company')