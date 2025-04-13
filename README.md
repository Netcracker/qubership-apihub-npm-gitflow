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