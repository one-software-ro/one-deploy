#!/usr/bin/env node
function oneDeploy() {
	var OneRestService = require(__dirname + '/one-rest');
	
	var zipFolder = require('zip-folder');
	var fs = require('fs-extra');
	
	var axios = require('axios').default;
	var wrapper = require('axios-cookiejar-support').wrapper;
	var CookieJar = require('tough-cookie').CookieJar;
	var MemoryCookieStore = require('tough-cookie').MemoryCookieStore;

	var store = new MemoryCookieStore();
	const jar = new CookieJar(store);

	const client = wrapper(axios.create({ jar }));

	var prompt = require('prompt');
	var colors = require('colors/safe');

	const errorCb = (message) => {
		console.log(colors.red('Aplicatia nu a fost inregistrata'));
		console.log(colors.red(message));
		process.exit(1);
	}
	
	const buildPrompt = (name, description) => {
		return {
			name: name,
			description: colors.green(description),
			required: true
		}
	}

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
			console.log(colors.red('Datele necesare nu au fost furnizate'));
			return;
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
			console.log(colors.red('Asigurate ca ./config_web_app.json este valid'));
			return;
		}

		if (!config.hasOwnProperty('web_app_name') || !config.hasOwnProperty('web_app_path') || !config.hasOwnProperty('instance') || !config.hasOwnProperty('dist_path')) {
			console.log(colors.red('Asigurate ca fisierul ./config_web_app.json contine urmatoarele proprietati: web_app_name, web_app_path dist_path si instance'));
			return;
		}

		var bundleFilesPresent = false;
		try {
			bundleFilesPresent = fs.existsSync(config.dist_path + '/index.html');
		} catch (error) {
			bundleFilesPresent = false;
		}

		if (!bundleFilesPresent) {
			console.log(colors.red('Asigurate ca index.html este prezent in directorul de build'));
			return;
		}

		zipFolder(config.dist_path, './web_app.zip', async function(err) {
			if (err) {
				console.log(colors.red('Arhiva nu a fost generata'));
				return;
			}

			let restApi = new OneRestService(client, config.instance, {}, store, errorCb);

			await restApi.auth(promptResult.username, promptResult.password);

			let result = await restApi.storage(fs.createReadStream('./web_app.zip'));

			let storageId = result[0].id;

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

			console.log(colors.green('Arhiva a fost instalata'));
		});
		
	});
};
module.exports = oneDeploy;