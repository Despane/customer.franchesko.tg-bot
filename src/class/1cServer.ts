import { createClientAsync, Client as SoapClient } from 'soap';
import * as path from 'path'
import * as fs from 'fs'
import express from 'express'

async function delay(ms:any) {
	return new Promise(resolve => setTimeout(resolve, ms));
}


export class  Enterprise {
	private static SOAP: SoapClient | null = null;

	/** Utility Methods */

	/**
	 * Generate a GUID (36|32 characters)
	 * @param notPrefix - Whether to remove hyphens
	 * @returns A GUID string
	 */
	static generateGUID(notPrefix: boolean = false): string {
		const guid = `${this.randomHex(4)}${this.randomHex(4)}-${this.randomHex(4)}-${this.randomHex(4)}-${this.randomHex(4)}-${this.randomHex(4)}${this.randomHex(4)}${this.randomHex(4)}`;

		return notPrefix ? guid.replace(/-/g, '') : guid;
	}

	private static randomHex(length: number): string {
		return [...Array(length)]
			.map(() => Math.floor(Math.random() * 16).toString(16))
			.join('');
	}

	/**
	 * Get the root URL of the server
	 * @param useSlash - Whether to add a trailing slash
	 * @returns The root URL string
	 */
	static getHomeURL(useSlash = true): string {
		const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';
		const host = process.env.HOST || 'localhost';
		return `${protocol}://${host}${useSlash ? '/' : ''}`;
	}

	/** SOAP Methods */

	/**
	 * Initialize SOAP client
	 * @throws Error if SOAP initialization fails
	 */
	private static async init(): Promise<void> {
		if (this.SOAP) return;

		const SOAP_server = 'app.francesco.ru';
		const SOAP_wsdl = '1cwebrt/ws/integration.1cws?wsdl';
		const SOAP_login = 'web';
		const SOAP_password = 'web';
		const SOAP_ssl = true;

		const SOAP_link = `${SOAP_ssl ? 'https' : 'http'}://${SOAP_server}/${SOAP_wsdl}`;

		const options = {
			wsdl_options: {
				headers: {
					'Authorization': 'Basic ' + Buffer.from(`${SOAP_login}:${SOAP_password}`).toString('base64'),
				},
				rejectUnauthorized: true, // Отключение проверки SSL
			},
		};
		process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
		try {
			this.SOAP = await createClientAsync(SOAP_link, options);
			console.log('SOAP Client Headers:', this.SOAP.wsdl_options?.headers);
			// Проверка, содержит ли клиент ожидаемые методы
			if (!this.SOAP.ping) {
				console.error('SOAP client does not contain the expected method: ping');
				throw new Error('Invalid SOAP client configuration: ping method is missing.');
			}

			console.log('SOAP Client Description:', this.SOAP.describe());
		} catch (error: any) {
			console.error('HTTP Status Code:', error.statusCode); // Это выведет код состояния HTTP
			console.error('Response Body:', error.responseBody); // Тело ответа, если есть
			throw new Error(`Failed to initialize SOAP client: ${error.message}`);
		}
	}

	/**
	 * Parse the SOAP response into an associated object
	 * @param data - SOAP response data
	 * @returns Parsed data
	 */
	private static associate(data: any): any {
		return data.return;
	}

	/**
	 * Parse SOAP response data into an object
	 * @param data - SOAP response data
	 * @returns Parsed object containing table and columns
	 */
	private static parse(data: any): { table: Record<string, any>; columns: Record<string, any>; hierarchical: boolean; total: number } {
		const table: Record<string, any> = {};
		const columns: Record<string, any> = {};

		for (const row of data.keys) {
			columns[row.key] = {
				key: row.key,
				type: row.type,
				name: row.name,
				description: row.description,
			};
		}

		for (const row of data.data) {
			const item = row as Record<string, any>;
			const key = columns[row.key].type;
			table[row.number] = {
				...table[row.number],
				[row.key]: item[key],
			};
		}

		return {
			table,
			columns,
			hierarchical: data.hierarchical,
			total: data.total,
		};
	}

	/**
	 * Ping the SOAP server
	 * @returns SOAP server response
	 * @throws Error if SOAP call fails
	 */
	static async ping(): Promise<boolean> {
		await this.init();

		if (!this.SOAP) {
			throw new Error('SOAP client is not initialized.');
		}

		this.SOAP.addHttpHeader('Authorization', 'Basic ' + Buffer.from(`web:web`).toString('base64'));

		try {
			const result = await new Promise<boolean>((resolve, reject) => {
				this.SOAP?.ping({}, (
					error: Error | null,
					result: any,
					rawResponse: any,
					soapHeader: any,
					rawRequest: any,
					mtomAttachments: any
				) => {
					if (error) {
						reject(error);
					} else {
						resolve(result);
					}
				});
			});

			console.log('Ping result:', result);
			return true;
		} catch (error: any) {
			console.error('Error during SOAP connection:', error);
			return false;
		}
	}
	static async getCardByPhone(phone: string): Promise<any> {
		await this.init(); // Инициализируем клиент, если еще не был инициализирован

		if (!this.SOAP) {
			throw new Error('SOAP client is not initialized.');
		}

		try {
			// Добавляем заголовок авторизации перед запросом
			this.SOAP.addHttpHeader('Authorization', 'Basic ' + Buffer.from(`web:web`).toString('base64'));

			// Оборачиваем вызов getCardByPhone в Promise
			const result = await new Promise<any>((resolve, reject) => {
				this.SOAP?.getCardByPhone({ phone }, (
					error: Error | null,
					result: any,
					rawResponse: any,
					soapHeader: any,
					rawRequest: any,
					mtomAttachments: any
				) => {
					if (error) {
						reject(error); // Ожидаем ошибку
					} else {
						resolve(result); // Ожидаем результат
					}
				});
			});

			let new_result = this.associate(result)
			console.log(new_result)
			if (new_result&&new_result.success === true){
				return [new_result?.card?.code,new_result?.card?.person];
			}
			else{
				throw new Error('Failed to getCardByPhone');
			}
			// Возвращаем ассоциированные данные
		} catch (error: any) {
			console.error('Error in getCardByPhone:', error);
			throw new Error('Failed to getCardByPhone');
		}
	}

	static async getBalanceByPhone(phone: string): Promise<any> {
		await this.init(); // Инициализируем клиент, если еще не был инициализирован

		if (!this.SOAP) {
			throw new Error('SOAP client is not initialized.');
		}

		try {
			// Добавляем заголовок авторизации перед запросом
			this.SOAP.addHttpHeader('Authorization', 'Basic ' + Buffer.from(`web:web`).toString('base64'));

			// Оборачиваем вызов SOAP-метода в Promise
			const result = await new Promise<any>((resolve, reject) => {
				this.SOAP?.getBalanceByPhone({ phone }, (
					error: Error | null,
					result: any,
					rawResponse: any,
					soapHeader: any,
					rawRequest: any,
					mtomAttachments: any
				) => {
					if (error) {
						reject(error); // Ловим ошибку
					} else {
						resolve(result); // Возвращаем результат
					}
				});
			});

			let new_result = this.associate(result)
			if (new_result&&new_result.success === true){
				return new_result?.card?.balance;
			}
			else{
				throw new Error('Failed to get balance by phone');
			}
			 // Возвращаем ассоциированные данные
		} catch (error: any) {
			console.error('Error in getBalanceByPhone:', error);
			throw new Error('Failed to get balance by phone');
		}
	}
	static async getHistory(code: string, limit: number = 0): Promise<any> {
		await this.init(); // Инициализируем клиент, если еще не был инициализирован

		if (!this.SOAP) {
			throw new Error('SOAP client is not initialized.');
		}

		try {
			// Добавляем заголовок авторизации перед запросом
			this.SOAP.addHttpHeader('Authorization', 'Basic ' + Buffer.from(`web:web`).toString('base64'));

			// Параметры запроса
			const options = { code, limit };

			// Оборачиваем вызов SOAP-метода в Promise
			const result = await new Promise<any>((resolve, reject) => {
				this.SOAP?.getHistory(options, (
					error: Error | null,
					result: any,
					rawResponse: any,
					soapHeader: any,
					rawRequest: any,
					mtomAttachments: any
				) => {
					if (error) {
						reject(error); // Ловим ошибку
					} else {
						resolve(result); // Возвращаем результат
					}
				});
			});

			let new_result = this.associate(result)
			console.log(new_result)
			if (new_result&&new_result.success === true){
				console.log(new_result?.bonusPoints)
				return new_result?.bonusPoints;
			}
			else{
				throw new Error('Failed to get history');
			} // Возвращаем ассоциированные данные
		} catch (error: any) {
			console.error('Error in getHistory:', error);
			throw new Error('Failed to get history');
		}
	}
	static async addNewCard(name: string, phone: string, email: string = '', telegram: number = 0): Promise<any> {
		await this.init(); // Инициализация SOAP-клиента

		if (!this.SOAP) {
			throw new Error('SOAP client is not initialized.');
		}

		try {
			// Добавляем заголовок авторизации перед запросом
			this.SOAP.addHttpHeader('Authorization', 'Basic ' + Buffer.from(`web:web`).toString('base64'));

			// Параметры запроса
			const options = { name, phone, email, telegram };

			// Оборачиваем SOAP-вызов в Promise
			const result = await new Promise<any>((resolve, reject) => {
				this.SOAP?.addNewCard(options, (
					error: Error | null,
					result: any
				) => {
					if (error) {
						reject(error);
					} else {
						resolve(result);
					}
				});
			});

			let new_result = this.associate(result)
			if (new_result&&new_result.success === true){
				console.log(new_result?.card?.code)
				return new_result?.card?.code;
			}
			else{
				throw new Error('Failed to add new card');
			}
		} catch (error: any) {
			console.error('Error in addNewCard:', error);
			throw new Error('Failed to add new card');
		}
	}
	static async getQRCard(code: string): Promise<any> {
		await this.init(); // Инициализация SOAP-клиента

		if (!this.SOAP) {
			throw new Error('SOAP client is not initialized.');
		}

		try {
			// Добавляем заголовок авторизации перед вызовом метода
			this.SOAP.addHttpHeader('Authorization', 'Basic ' + Buffer.from(`web:web`).toString('base64'));

			// Параметры запроса
			const options = { code };

			// Оборачивание SOAP-вызова в Promise
			const result = await new Promise<any>((resolve, reject) => {
				this.SOAP?.getQRCard(options, (error: Error | null, result: any) => {
					if (error) {
						reject(error);
					} else {
						resolve(result);
					}
				});
			});

			const data = this.associate(result);

			// Генерация уникального имени файла
			const fileName = `${this.generateGUID()}.${data.QR.extension}`;
			const cacheDir = path.join(__dirname, 'cache');

			// Проверка существования папки, если её нет — создаём
			if (!fs.existsSync(cacheDir)) {
				fs.mkdirSync(cacheDir, { recursive: true });
			}

			// Полный путь к файлу
			const filePath = path.join(cacheDir, fileName);
			const publicPath = `/cache/${fileName}`;
			const fullURL = `${this.getHomeURL()}${publicPath}`;

			// Декодирование base64 и запись в новый файл
			await fs.promises.writeFile(filePath, Buffer.from(data.QR.base64, 'base64'));

			// Удаление файла через 2 минуты (120000 миллисекунд)
			setTimeout(async () => {
				try {
					if (fs.existsSync(filePath)) {
						await fs.promises.unlink(filePath); // Удаляем файл
						console.log(`File ${filePath} deleted after 2 minutes.`);
					}
				} catch (error) {
					console.error('Error deleting file:', error);
				}
			}, 120000); // 2 минуты

			// Добавляем пути к объекту данных
			data.path = filePath;
			data.src = publicPath;
			data.url = fullURL;

			return fileName;
		} catch (error: any) {
			console.error('Error in getQRCard:', error);
			throw new Error('Failed to get QR card');
		}
	}
	static async updateCardDetailsByPhone(phone: string, email: string = '', telegram: number = 0): Promise<any> {
		await this.init(); // Инициализация SOAP-клиента

		if (!this.SOAP) {
			throw new Error('SOAP client is not initialized.');
		}

		try {
			// Добавляем заголовок авторизации перед запросом
			this.SOAP.addHttpHeader('Authorization', 'Basic ' + Buffer.from(`web:web`).toString('base64'));

			// Параметры запроса
			const options = {phone, email, telegram };

			// Оборачиваем SOAP-вызов в Promise
			const result = await new Promise<any>((resolve, reject) => {
				this.SOAP?.updateCardDetailsByPhone(options, (
					error: Error | null,
					result: any
				) => {
					if (error) {
						reject(error);
					} else {
						resolve(result);
					}
				});
			});

			let new_result = this.associate(result)
			if (new_result&&new_result.success === true){
				console.log(new_result?.card?.code)
				return new_result?.card?.code;
			}
			else{
				throw new Error('Failed to updateCardDetailsByPhone');
			}
		} catch (error: any) {
			console.error('Error in updateCardDetailsByPhone:', error);
			throw new Error('Failed to updateCardDetailsByPhone');
		}
	}
}


// Example Express Setup
// const app = express();
// const PORT = process.env.PORT || 3010;
//
// app.get('/ping', async (req, res) => {
// 	try {
// 		const response = await Enterprise.ping();
// 		res.json({ success: true, data: response });
// 	} catch (error) {
// 		res.status(500).json({ success: false, message: (error as Error).message });
// 	}
// });
// app.get('/card-by-phone', async (req, res) => {
// 	const { phone } = req.query;
//
// 	// Проверка на наличие параметра phone
// 	if (!phone || typeof phone !== 'string') {
// 		return res.status(400).json({ success: false, message: 'Phone parameter is required and must be a string.' });
// 	}
//
// 	try {
// 		const response = await Enterprise.getCardByPhone(phone);
// 		res.json({ success: true, data: response });
// 	} catch (error) {
// 		res.status(500).json({ success: false, message: (error as Error).message });
// 	}
// });
// app.get('/balance', async (req, res) => {
// 	const { phone } = req.query;
//
// 	// Проверка на наличие параметра phone
// 	if (!phone || typeof phone !== 'string') {
// 		return res.status(400).json({ success: false, message: 'Phone parameter is required and must be a string.' });
// 	}
//
// 	try {
// 		const response = await Enterprise.getBalanceByPhone(phone);
// 		res.json({ success: true, data: response });
// 	} catch (error) {
// 		res.status(500).json({ success: false, message: (error as Error).message });
// 	}
// });
// app.get('/history', async (req, res) => {
// 	const { code, limit } = req.query;
//
// 	// Проверяем наличие параметра code и приводим limit к числу
// 	if (!code || typeof code !== 'string') {
// 		return res.status(400).json({ success: false, message: 'Code parameter is required and must be a string.' });
// 	}
//
// 	const parsedLimit = limit ? parseInt(limit as string, 10) : 0;
// 	if (isNaN(parsedLimit) || parsedLimit < 0) {
// 		return res.status(400).json({ success: false, message: 'Limit must be a non-negative integer.' });
// 	}
//
// 	try {
// 		const response = await Enterprise.getHistory(code, parsedLimit);
// 		res.json({ success: true, data: response });
// 	} catch (error) {
// 		res.status(500).json({ success: false, message: (error as Error).message });
// 	}
// });
// app.get('/qr-card', async (req, res) => {
// 	const { code } = req.query;
//
// 	// Проверка параметра code
// 	if (!code || typeof code !== 'string') {
// 		return res.status(400).json({ success: false, message: 'Code parameter is required and must be a string.' });
// 	}
//
// 	try {
// 		const response = await Enterprise.getQRCard(code);
//
// 		// Проверяем, существует ли файл, прежде чем отправить его
// 		if (fs.existsSync(response.path)) {
// 			res.json({ success: true, data: response });
// 		} else {
// 			res.status(500).json({ success: false, message: 'QR image file not found.' });
// 		}
// 	} catch (error) {
// 		res.status(500).json({ success: false, message: (error as Error).message });
// 	}})
// app.get('/addCard', async (req, res) => {
// 	const name = req.query.name as string;
// 	const phone = req.query.phone as string;
// 	const email = req.query.email as string;
// 	const telegram = req.query.telegram as string;
//
// 	// Проверка параметра code
// 	if (!name || typeof name !== 'string' || name.trim().length === 0) {
// 		return res.status(400).json({ success: false, message: 'Name parameter is required and must be a non-empty string.' });
// 	}
//
// 	if (!phone || typeof phone !== 'string' || !/^\+?[1-9]\d{1,14}$/.test(phone)) {
// 		return res.status(400).json({ success: false, message: 'Phone parameter is required and must be a valid phone number.' });
// 	}
//
// 	if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
// 		return res.status(400).json({ success: false, message: 'Email parameter is required and must be a valid email address.' });
// 	}
//
// 	let telegramNumber: number | null = null;
// 	if (telegram && typeof telegram === 'string' && /^\d+$/.test(telegram)) {
// 		telegramNumber = parseInt(telegram, 10);
// 	} else {
// 		return res.status(400).json({ success: false, message: 'Telegram parameter is required and must be a valid number.' });
// 	}
//
// 	try {
// 		const response = await Enterprise.addNewCard(name,phone,email,telegramNumber);
//
// 		// Проверяем, существует ли файл, прежде чем отправить его
// 		if (response) {
// 			res.json({ success: true, data: response });
// 		} else {
// 			res.status(500).json({ success: false, message: 'QR image file not found.' });
// 		}
// 	} catch (error) {
// 		res.status(500).json({ success: false, message: (error as Error).message });
// 	}})
// app.get('/updateCard', async (req, res) => {
// 	const phone = req.query.phone as string;
// 	const email = req.query.email as string;
// 	const telegram = req.query.telegram as string;
//
// 	if (!phone || typeof phone !== 'string' || !/^\+?[1-9]\d{1,14}$/.test(phone)) {
// 		return res.status(400).json({ success: false, message: 'Phone parameter is required and must be a valid phone number.' });
// 	}
//
//
// 	let telegramNumber: number | null = null;
// 	if (telegram && typeof telegram === 'string' && /^\d+$/.test(telegram)) {
// 		telegramNumber = parseInt(telegram, 10);
// 	} else {
// 		return res.status(400).json({ success: false, message: 'Telegram parameter is required and must be a valid number.' });
// 	}
//
// 	try {
// 		const response = await Enterprise.updateCardDetailsByPhone(phone,email,telegramNumber);
//
// 		// Проверяем, существует ли файл, прежде чем отправить его
// 		if (response) {
// 			res.json({ success: true, data: response });
// 		} else {
// 			res.status(500).json({ success: false, message: 'QR image file not found.' });
// 		}
// 	} catch (error) {
// 		res.status(500).json({ success: false, message: (error as Error).message });
// 	}})
// app.listen(PORT, () => {
// 	console.log(`Server is running on port ${PORT}`);
// });
