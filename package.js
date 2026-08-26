Package.describe({
	name: 'poon-stripe',
	version: '1.0.0',
	summary: 'Stripe webhook utilities for Poon apps',
});

Npm.depends({
	express: '5.2.1',
});

Package.onUse(api => {
	api.use('ecmascript');
	api.use('meteor');
	api.use('modules');
	api.use('poon-api');
	api.mainModule('index.js', 'server');
});
