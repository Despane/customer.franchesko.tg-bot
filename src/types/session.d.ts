import { Context } from 'telegraf';
declare namespace Telegraf {
	export interface Context {
		session: {
			isRegistered?: boolean;
			phone?: string;
			name?: string;
		};
	}
}