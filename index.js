#!/usr/bin/env node

import { createRequire } from 'module'
const require = createRequire(import.meta.url);

import OneRestClient from 'one-rest-client';
	
var zipFolder = require('zip-folder');
var fs = require('fs-extra');

var axios = require('axios').default;
var wrapper = require('axios-cookiejar-support').wrapper;
var CookieJar = require('tough-cookie').CookieJar;
var MemoryCookieStore = require('tough-cookie').MemoryCookieStore;

var prompt = require('prompt');
var colors = require('colors/safe');

var store = new MemoryCookieStore();

async function getCookie (cookieName) {
	let cookies = await store.getAllCookies()
	for (let ind = 0; ind < cookies.length; ind++) {
		if (cookies[ind].key === cookieName) {
			return cookies[ind].value;
		}
	}
	return null;
}

function buildPrompt (name, description) {
	return {
		name: name,
		description: colors.green(description),
		required: true
	}
}

export function oneDeploy() {
	const client = wrapper(axios.create({ jar: new CookieJar(store) }));

	var instance = buildPrompt('instance', 'ONE instance');
	
	var username = buildPrompt('username', 'ONE username');

	var webAppName = buildPrompt('web_app_name', 'WebApp name');
	
	var webAppPath = buildPrompt('web_app_path', 'WebApp path');

	var distPath = buildPrompt('dist_path', 'Build path');
	
	var password = {
		name: 'password',
		description: colors.green('ONE password'),
		hidden: true
	};
	
	var bundleConfigPresent = false;
	try {
		bundleConfigPresent = fs.existsSync('./config_web_app.json');
	} catch (error) {
		bundleConfigPresent = false;
	}

	let arrayPrompts = [];
	if (!bundleConfigPresent) {
		arrayPrompts.push(webAppName);
		arrayPrompts.push(webAppPath);
		arrayPrompts.push(instance);
		arrayPrompts.push(distPath);
	}
	arrayPrompts.push(username);
	arrayPrompts.push(password);
	
	prompt.message = '';
	prompt.delimiter = ':';
	
	prompt.start();
	
	prompt.get(arrayPrompts, function (err, promptResult) {
		if (err) {
			console.log(colors.red('Required info was not provided'));
			process.exit(1);
		}
	
		if (!bundleConfigPresent) {
			let bundle = {
				'web_app_name': promptResult.web_app_name,
				'web_app_path': promptResult.web_app_path,
				'instance': promptResult.instance,
				'dist_path': promptResult.dist_path
			};
			fs.writeFileSync('./config_web_app.json', JSON.stringify(bundle, null, 4));
		}

		let config = {};
		try {
			config = JSON.parse(fs.readFileSync('config_web_app.json'));
		} catch (jsonParseError) {
			console.log(colors.red('Make sure config_web_app.json is valid'));
			process.exit(1);
		}

		if (!config.hasOwnProperty('web_app_name') || !config.hasOwnProperty('web_app_path') || !config.hasOwnProperty('instance') || !config.hasOwnProperty('dist_path')) {
			console.log(colors.red('Make sure config_web_app.json has the following fields: web_app_name, web_app_path, dist_path and instance'));
			process.exit(1);
		}

		var bundleFilesPresent = false;
		try {
			bundleFilesPresent = fs.existsSync(config.dist_path + '/index.html');
		} catch (error) {
			bundleFilesPresent = false;
		}

		if (!bundleFilesPresent) {
			console.log(colors.red('Make sure index.html is present in your web app\'s build path'));
			process.exit(1);
		}

		const zipCb = async function(err) {
			if (err) {
				console.log(colors.red('Failed to build an archive of your web application'));
				console.log(colors.red('Your web application has not been deployed'));
				console.error(err)
				process.exit(1);
			}

			try {
				let restApi = new OneRestClient(client, config.instance, null, getCookie);

				await restApi.auth(promptResult.username, promptResult.password);
	
				let storageId = await restApi.storage(fs.createReadStream('./web_app.zip'));
	
				let webApp = {
					'entity_name': 'web_app',
					'properties': {
					   'name': config.web_app_name,
					   'path': config.web_app_path,
					   'id_storage_file': storageId
					}
				 };
	
				let queryData = await restApi.fetch('FETCH web_app(key) FILTER AND(name == \"' + config.web_app_name + '\", path == \"' + config.web_app_path + '\")');
	
				if (queryData !== undefined && queryData !== null && queryData.length > 0) {
					webApp.properties['key'] = queryData[0]['key'];
					await restApi.update('web_app', webApp);
				} else {
					await restApi.put('web_app', webApp);
				}
	
				console.log(colors.green('Your web application has been deployed'));
			} catch(error) {
				console.log(colors.red('Your web application has not been deployed'));
				console.error(error)
				process.exit(1);
			}
		};

		zipFolder(config.dist_path, './web_app.zip', zipCb);
	});
};