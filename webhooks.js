import { Meteor } from 'meteor/meteor';
import { createHmac, timingSafeEqual } from 'crypto';
import express from 'express';
import { api } from 'meteor/poon-api';

const stripeEventListeners = new Map();

const verifyStripeSignature = (req, res, next) => {
	const secret = Meteor.isDevelopment ? Meteor.settings.stripeWebhookTest : Meteor.settings.stripeWebhookKey;
	const body = req.body.toString('utf8');
	const header = req.headers['stripe-signature'];

	try {
		if (!secret) throw new Meteor.Error('stripe', 'Stripe webhook secret is not configured');
		if (!header) throw new Meteor.Error('stripe', 'Stripe signature is missing');

		const signature = Object.fromEntries(header.split(',').map(part => part.split('=')));
		const expected = createHmac('sha256', secret).update(`${signature.t}.${body}`).digest('hex');
		if (!signature.v1 || expected.length !== signature.v1.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature.v1))) {
			throw new Meteor.Error('stripe', 'Stripe signature is invalid');
		}

		req.stripeEvent = JSON.parse(body);
		next();
	} catch (err) {
		res.status(400).json({'error': err.reason || err.message});
	}
};

export const registerStripeEventListener = (eventType, listener) => {
	const listeners = stripeEventListeners.get(eventType) || [];
	listeners.push(listener);
	stripeEventListeners.set(eventType, listeners);

	return () => {
		stripeEventListeners.set(eventType, stripeEventListeners.get(eventType).filter(registered => registered !== listener));
	};
};

api.post('/stripe', [express.raw({type: 'application/json'}), verifyStripeSignature], async (req, res) => {
	try {
		const event = req.stripeEvent;
		console.log('[webhook]', event.type, event.data);
		for (const listener of stripeEventListeners.get(event.type) || []) {
			await listener(event);
		}

		res.json({'received': true});
	} catch (err) {
		res.status(400).json({'error': err.reason || err.message});
	}
});
