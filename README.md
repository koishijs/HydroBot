# A Simple QQ Robot

## How to use:  

### Requirements: 

[Nodejs](nodejs.org)  
[Yarn](yarnpkg.com)

### Install

```sh
git clone https://github.com/masnn/qqbot.git
cd qqbot
yarn
yarn build
```
 
### Run CoolQ
[go-cqhttp](https://github.com/mrs4s/gp-cqhttp) is required, and it should run under websocket mode.

### Write config file
rename config.sample.json to config.json and make some change.

### Run bot  

```sh
node bin/robot.js # or `yarn debug`
```