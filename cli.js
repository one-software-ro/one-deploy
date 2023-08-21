#!/usr/bin/env node
const oneDeployScript = new URL("index.js", import.meta.url);
const deployer = await import(oneDeployScript);
deployer.oneDeploy();