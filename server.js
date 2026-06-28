import { Meteor } from 'meteor/meteor';
import { createSearchParams } from './util';

export { registerStripeEventListener } from './webhooks';

export const STRIPE_VERSION = '2026-05-27.dahlia';

const createFileBlob = dataUrl => {
	const [, contentType, data] = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
	const extension = contentType.split('/')[1];
	return {
		'blob': new Blob([Buffer.from(data, 'base64')], {'type': contentType}),
		'filename': `splashscreen.${extension}`,
	};
};

export class StripeClient {
	constructor(secretKey) {
		this.secretKey = secretKey;
	}

	request = async (path, data = {}, method = 'POST') => {
		const response = await fetch(`https://api.stripe.com/v1/${path}`, {
			method,
			'headers': {
				'Authorization': `Bearer ${this.secretKey}`,
				'Content-Type': 'application/x-www-form-urlencoded',
				'Stripe-Version': STRIPE_VERSION,
			},
			'body': method === 'POST' ? createSearchParams(data) : undefined,
		});
		const json = await response.json();
		if (!response.ok) {
			console.warn('[StripeClient] Request failed', {
				method,
				path,
				'status': response.status,
				'type': json.error?.type,
				'code': json.error?.code,
				'message': json.error?.message,
			});
			throw new Meteor.Error('stripe', json.error.message);
		}
		return json;
	};

	uploadFile = async (dataUrl, purpose) => {
		const file = createFileBlob(dataUrl);
		const body = new FormData();
		body.append('file', file.blob, file.filename);
		body.append('purpose', purpose);

		const response = await fetch('https://files.stripe.com/v1/files', {
			'method': 'POST',
			'headers': {
				'Authorization': `Bearer ${this.secretKey}`,
				'Stripe-Version': STRIPE_VERSION,
			},
			body,
		});
		const json = await response.json();
		if (!response.ok) {
			console.warn('[StripeClient] File upload failed', {
				'status': response.status,
				'type': json.error?.type,
				'code': json.error?.code,
				'message': json.error?.message,
			});
			throw new Meteor.Error('stripe', json.error.message);
		}
		return json;
	};

	createLineItem = item => ({
		'price_data': {
			'currency': 'usd',
			'product_data': {
				'name': item.name,
			},
			'unit_amount': Math.round(item.price * 100),
		},
		'quantity': item.count,
	});

	createTaxLineItem = price => ({
		'price_data': {
			'currency': 'usd',
			'product_data': {
				'name': 'Tax',
			},
			'unit_amount': Math.round(price.tax * 100),
		},
		'quantity': 1,
	});

	createCheckoutSession = async (order, price) => {
		return await this.request('checkout/sessions', {
			'mode': 'payment',
			'ui_mode': 'elements',
			'return_url': `${Meteor.absoluteUrl()}kiosk/${order._id}/payment`,
			'line_items': [
				...order.items.map(this.createLineItem),
				this.createTaxLineItem(price),
			],
			'client_reference_id': order._id,
			'metadata': {
				'orderId': order._id,
			},
			'payment_method_types': ['card'],
		});
	};

	createConnectAccount = async opts => {
		return await this.request('accounts', opts);
	};

	createAccountLink = async opts => {
		return await this.request('account_links', opts);
	};

	createPaymentIntent = async opts => {
		return await this.request('payment_intents', opts);
	};

	createTerminalLocation = async opts => {
		return await this.request('terminal/locations', opts);
	};

	retrieveTerminalLocation = async locationId => {
		return await this.request(`terminal/locations/${locationId}`, {}, 'GET');
	};

	updateTerminalLocation = async (locationId, opts) => {
		return await this.request(`terminal/locations/${locationId}`, opts);
	};

	createTerminalConfiguration = async opts => {
		return await this.request('terminal/configurations', opts);
	};

	updateTerminalConfiguration = async (configurationId, opts) => {
		return await this.request(`terminal/configurations/${configurationId}`, opts);
	};

	createTerminalReader = async ({registrationCode, location}) => {
		return await this.request('terminal/readers', {
			'registration_code': registrationCode,
			location,
		});
	};

	retrieveTerminalReader = async readerId => {
		return await this.request(`terminal/readers/${readerId}`, {}, 'GET');
	};

	deleteTerminalReader = async readerId => {
		return await this.request(`terminal/readers/${readerId}`, {}, 'DELETE');
	};

	cancelTerminalReaderAction = async readerId => {
		return await this.request(`terminal/readers/${readerId}/cancel_action`);
	};

	processReaderPaymentIntent = async ({readerId, paymentIntentId}) => {
		return await this.request(`terminal/readers/${readerId}/process_payment_intent`, {
			'payment_intent': paymentIntentId,
			'process_config': {
				'enable_customer_cancellation': true,
			},
		});
	};

	cancelPaymentIntent = async paymentIntentId => {
		return await this.request(`payment_intents/${paymentIntentId}/cancel`);
	};

	uploadTerminalReaderSplashscreen = async dataUrl => {
		return await this.uploadFile(dataUrl, 'terminal_reader_splashscreen');
	};
}

export default new StripeClient(Meteor.isDevelopment ? Meteor.settings.stripeTest : Meteor.settings.stripeKey);
