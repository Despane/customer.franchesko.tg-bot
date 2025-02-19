import { Context } from "telegraf";
import { UserService } from "../service/UserService";
import { Enterprise } from '../class/1cServer'
import * as path from 'path'
import dns from "dns";
function isValidUserName(name: string): boolean {
	// Проверка длины имени (2–50 символов)
	if (name.length < 2 || name.length > 50) {
		return false;
	}

	// Регулярное выражение: только буквы, пробелы и дефисы
	const nameRegex = /^[A-Za-zА-Яа-яЁё\s-]+$/;
	return nameRegex.test(name);
}
function isValidEmailFormat(email: string): boolean {
	// Проверка длины email (минимум 6 символов, максимум 100)
	if (email.length < 6 || email.length > 100) {
		return false;
	}

	// Регулярное выражение для базовой валидации email
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

async function hasMxRecord(email: string): Promise<boolean> {
	const domain = email.split("@")[1];
	if (!domain) return false;

	try {
		const records = await dns.promises.resolveMx(domain);
		return records.length > 0;
	} catch {
		return false;
	}
}
const BUTTONS = {
	SEND_PHONE: {
		text: "Отправить номер телефона",
		request_contact: true,
	},
	CHANGE_PHON:{
		text: "Изменить телефон",
	},
	REPEAT_CODE:{
		text: "Запросить код повторно",
	},
	LOGOUT: {
		text: "Выйти",
	},
	BALANCE: {
		text: "Баланс",
	},
	QR_CODE: {
		text: "QR-код",
	},
	LAST_OPERATIONS: {
		text: "Последние операции",
	},
	CHANGE_MAIL: {
		text: "Сменить почту",
	},
	ACCII:{
	text: "Актуальные акции",
}
};

const KEYBOARDS = {
	SEND_PHONE: {
		reply_markup: {
			keyboard: [[BUTTONS.SEND_PHONE]],
			resize_keyboard: true,
			one_time_keyboard: true,
		},
	},
	CHANGE_PHONE1: {
		reply_markup: {
			keyboard: [[BUTTONS.CHANGE_PHON]],
			resize_keyboard: true,
			one_time_keyboard: true,
		},
	},
	CHANGE_PHONE: {
		reply_markup: {
			keyboard: [[BUTTONS.REPEAT_CODE]],
			resize_keyboard: true,
			one_time_keyboard: true,
		},
	},
	AUTHORIZED: {
		reply_markup: {
			keyboard: [
				[BUTTONS.BALANCE, BUTTONS.QR_CODE],
				[BUTTONS.LAST_OPERATIONS, BUTTONS.LOGOUT,BUTTONS.CHANGE_MAIL,BUTTONS.ACCII],
			],
			resize_keyboard: true,
		},
	},
	REMOVE: {
		reply_markup: {
			remove_keyboard: true as true,
		},
	},

};


export class UserController {
	private userService: UserService;

	constructor(userService: UserService) {
		this.userService = userService;
	}

	public async handleStart(ctx: Context): Promise<void> {
		const userId = ctx.from?.id;

		if (!userId) return;

		const user = this.userService.getUserInfo(userId);

		if (!user) {
			this.userService.addUser(userId, "", "");
			this.userService.updateUserState(userId, "awaiting_phone");


				await ctx.reply(
					"Добро пожаловать в клуб привилегий Francesco Donni! 💫 Теперь шопинг стал еще выгодней! 🎁\n\n" +
					"Я отвечу на ваши вопросы, смогу уведомлять об интересных акциях, проверять баланс и списывать баллы.\n\n" +
					"Для начала работы, пожалуйста, предоставьте ваш номер телефона.",
				KEYBOARDS.SEND_PHONE
			);
		} else if (user.state === "awaiting_phone") {
			await ctx.reply(
				"Вы еще не завершили регистрацию. Пожалуйста, предоставьте ваш номер телефона.",
				KEYBOARDS.SEND_PHONE
			);
		} else if (user.state === "awaiting_code") {
			await ctx.reply("Пожалуйста, введите код, отправленный на ваш номер телефона.",KEYBOARDS.REMOVE);
		} else if (user.state === "authorized") {
			await ctx.reply("Вы авторизованы! Выберите нужное действие", KEYBOARDS.AUTHORIZED);
		}
	}

	public async handleContact(ctx: Context): Promise<void> {
		const userId = ctx.from?.id;

		if (!userId) return;

		if (ctx.message && "contact" in ctx.message) {
			const contact = ctx.message.contact;

			if (contact && contact.phone_number) {
				let user = this.userService.getUserInfo(userId);

				if (user && user.state === "awaiting_phone") {
					try {
						let tempUser = await Enterprise.getCardByPhone(contact.phone_number);

						if (tempUser) {
							// Если получили данные, добавляем их пользователю и авторизуем
							try{this.userService.addUser(userId, tempUser[1], contact.phone_number);
								this.userService.updateUserCode(userId,tempUser[0])
								const code = this.userService.generateVerificationCode(userId,contact.phone_number);
								//console.log(`Сгенерированный код для пользователя ${userId}: ${code}`);
								this.userService.updateUserState(userId, "awaiting_code");
								await ctx.reply(`Ваш номер телефона (${contact.phone_number}) успешно получен! ✅`, KEYBOARDS.REMOVE
								);
								await ctx.reply(
									`Мы отправили вам код, введите его для авторизации.`,{
										reply_markup: {
											inline_keyboard: [
												[{ text: "Изменить телефон", callback_data: "change_phone" }]
											]
										}
									}
								);
								setTimeout(async () => {
									// Проверяем условие, чтобы клавиатура появилась только в нужном состоянии
									if (user?.state === 'awaiting_code') {
										await ctx.reply(
											"Введите код для завершения регистрации.",
											KEYBOARDS.CHANGE_PHONE  // Клавиатура с кнопкой "Изменить телефон"
										);
									}
								}, 60000);
							}
							catch (e) {
								await ctx.reply(
									`Ваш номер телефона (${contact.phone_number}) успешно получен! ✅ Мы отправили вам код, введите его для завершения регистрации.`,{
										reply_markup: {
											inline_keyboard: [
												[{ text: "Изменить телефон", callback_data: "change_phone" }]
											]
										}
									}
								)
								this.userService.addUser(userId, "", "");
								this.userService.updateUserState(userId, "unauthorized");

								setTimeout(async () => {
									// Проверяем условие, чтобы клавиатура появилась только в нужном состоянии
									if (user?.state === 'awaiting_code') {
										await ctx.reply(
											"Введите код для завершения регистрации.",
											KEYBOARDS.CHANGE_PHONE  // Клавиатура с кнопкой "Изменить телефон"
										);
									}
								}, 60000);
							}
						} else {
							throw new Error("Данные о пользователе не найдены.");
						}
					} catch (error) {
						console.error("Ошибка при получении карточки пользователя:", error);
						// Запускаем процесс регистрации
						try{const code = this.userService.generateVerificationCode(userId,contact.phone_number);
							//console.log(`Сгенерированный код для пользователя ${userId}: ${code}`);
							this.userService.addUser(userId, "", contact.phone_number);
							this.userService.updateUserState(userId, "awaiting_code");
							await ctx.reply(`Ваш номер телефона (${contact.phone_number}) успешно получен! ✅`, KEYBOARDS.REMOVE
							);
							await ctx.reply(
								`Мы отправили вам код, введите его для завершения регистрации.`,{
									reply_markup: {
										inline_keyboard: [
											[{ text: "Изменить телефон", callback_data: "change_phone" }]
										]
									}
								}
							);
							setTimeout(async () => {
								// Проверяем условие, чтобы клавиатура появилась только в нужном состоянии
								if (user?.state === 'awaiting_code') {
									await ctx.reply(
										"Введите код для завершения регистрации.",
										KEYBOARDS.CHANGE_PHONE  // Клавиатура с кнопкой "Изменить телефон"
									);
								}
							}, 60000);
						}
						catch (e) {
							await ctx.reply(`Ваш номер телефона (${contact.phone_number}) успешно получен! ✅`, KEYBOARDS.REMOVE
							);
							await ctx.reply(
								`Мы отправили вам код, введите его для завершения регистрации.`,{
									reply_markup: {
										inline_keyboard: [
											[{ text: "Изменить телефон", callback_data: "change_phone" }]
										]
									}
								}
							)
							this.userService.addUser(userId, "", "");
							this.userService.updateUserState(userId, "unauthorized");

							setTimeout(async () => {
								// Проверяем условие, чтобы клавиатура появилась только в нужном состоянии
								if (user?.state === 'awaiting_code') {
									await ctx.reply(
										"Введите код для завершения регистрации.",
										KEYBOARDS.CHANGE_PHONE  // Клавиатура с кнопкой "Изменить телефон"
									);
								}
							}, 60000);
						}
					}
				} else if (user && user.state === "authorized") {
					await ctx.reply("Вы уже авторизованы! Выберите /start для продолжения работы?");
				}
			} else {
				await ctx.reply("Не удалось получить номер телефона. Попробуйте снова.");
			}
		} else {
			await ctx.reply("Ожидался контакт, но сообщение его не содержит.");
		}
	}

	public async handleText(ctx: Context): Promise<void> {
		const userId = ctx.from?.id;

		if (!userId) return;

		const messageText = ctx.message && "text" in ctx.message ? ctx.message.text : null;

		if (!messageText) {
			ctx.reply("Сообщение не содержит текста или отсутствует.");
			return;
		}

		const user = this.userService.getUserInfo(userId);

		if (!user) {
			await ctx.reply("Пожалуйста, начните с команды /start.");
			return;
		}

		if (user.state === "authorized") {
			switch (messageText) {
				case BUTTONS.BALANCE.text:
					try {
						const balanceData = await Enterprise.getBalanceByCode(user.code!);

						// Формируем текст для ответа
						let responseText = `Ваш баланс: ${balanceData.balance} ₽`;

						if (balanceData.plannedDescriptions.length > 0) {
							responseText += `\n\n📅 *Запланированные списания бонусов:*\n`;
							responseText += balanceData.plannedDescriptions.map((desc:string) => `- ${desc}`).join("\n");
						} else {
							responseText += `\n\n✅ У вас нет запланированных списаний.`;
						}
						await ctx.reply(responseText, { parse_mode: "Markdown" });
					} catch (error) {
						console.error("Ошибка получения баланса:", error);
						await ctx.reply("Не удалось получить баланс. Попробуйте позже.");
					}
					return;
				case BUTTONS.QR_CODE.text:
					try {
						if(user.code){
						const qr = await Enterprise.getQRCard(user.code);
						const filePath = path.join(__dirname,'..', 'class', 'cache', qr);
						await ctx.reply("Покажите этот код на кассе сотруднику магазина для списания и начисления бонусов.");
						await ctx.replyWithPhoto({ source: filePath });
					}
						else{
							await ctx.reply("Не удалось получить qr-код. Код не найден.Попробуйте позже.");
						}
					}
					catch (error) {
						console.error("Ошибка получения qr-кода:", error);
						await ctx.reply("Не удалось получить qr-код. Попробуйте позже.");
					}
					return;
				case BUTTONS.LAST_OPERATIONS.text:
					try {
						if(user.code){
						const history = await Enterprise.getHistory(user.code);
						//console.log(history)
						if (!history||!history.length) {
							await ctx.reply("История пуста.");
							return;
						}

						let escapeMarkdown = (text:any) => {
							return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");// Экранирование спецсимволов MarkdownV2
						};

						let message = "📜 *Ваша история бонусов:*\n\n";

						history.forEach((entry:any) => {
							const date = new Date(entry.date).toISOString().split("T")[0].split("-").reverse().join(".");
							message += `📅 *Дата:* ${escapeMarkdown(date)}\n`;
							message += `🔹 *Описание:* ${escapeMarkdown(entry.description)}\n`;
							message += `💰 *Баллы:* ${entry.total > 0 ? `\\+${escapeMarkdown(entry.total.toString())}` : escapeMarkdown(entry.total.toString())} баллов\n`;
							message += `\n───────────────\n`;
						});

						await ctx.replyWithMarkdownV2(message);}
						else{
							await ctx.reply("Не удалось получить баланс. Код не найден. Попробуйте позже.");
						}
					} catch (error) {
						console.error("Ошибка получения истории:", error);
						await ctx.reply("Не удалось получить истории операций. Попробуйте позже.");
					}
					return;
				case BUTTONS.LOGOUT.text:
					this.userService.removeUser(userId);
					await ctx.reply(
						"Вы успешно вышли из системы. Для повторной регистрации используйте команду /start.",
						KEYBOARDS.REMOVE
					);
					return;
				case BUTTONS.CHANGE_MAIL.text:
					this.userService.updateUserState(userId, "awaiting_mail_adress");
					await ctx.reply(
						"Введите новую почту. Для возврата меню введите любой текст кроме почты"
					);
					return;
				case BUTTONS.ACCII.text:
					// Отправляем сообщение с inline кнопкой, которая ведет по ссылке
					await ctx.reply(
						"Нажмите на кнопку ниже для перехода к актуальным акциям:",
						{
							reply_markup: {
								inline_keyboard: [
									[
										{
											text: "Актуальные акции",  // Текст кнопки
											url: "https://francesco.ru/aktsii/"  // Ссылка
										},
									],
								],
							},
						}
					);
					return;
				default:
					await ctx.reply("Вы уже авторизованы! Выберите /start для продолжения работы?", KEYBOARDS.AUTHORIZED);
					return;
			}
		}
		if(user.state === "awaiting_mail_adress"){
			try {
				// Проверяем формат email
				if (!isValidEmailFormat(messageText)) {
					await ctx.reply(`Некорректный формат email. Возврат в меню`,KEYBOARDS.AUTHORIZED);
					this.userService.updateUserState(userId, "authorized");
					return;
				}
				// Проверяем MX-запись
				const isDomainValid = await hasMxRecord(messageText);
				if (!isDomainValid) {
					await ctx.reply(`Некорректный формат email. Возврат в меню`,KEYBOARDS.AUTHORIZED);
					this.userService.updateUserState(userId, "authorized");
					return;
				}
				// Если email валиден — продолжаем регистрацию
				let regUser = await Enterprise.updateCardDetailsByPhone(user.phone, messageText, user.id);
				this.userService.updateUserState(userId, "authorized");
				if (regUser){
					await ctx.reply(`Данные обновлены.`, KEYBOARDS.AUTHORIZED);
					return;
				}
			} catch (e) {
				//console.log(e)
				await ctx.reply(`Произошла ошибка, попробуйте позже.`);
				this.userService.updateUserState(userId, "authorized");
				return;
			}
		}
		// Проверяем состояние пользователя
		if (user.state === "awaiting_phone") {
			// Проверяем, является ли сообщение корректным номером телефона
			const phoneRegex = /^(\+7|7|8)\d{10}$/; // Стандартный формат E.164
			if (phoneRegex.test(messageText)) {
				try {
					let tempUser = await Enterprise.getCardByPhone(messageText);

					if (tempUser) {
						// Если получили данные, добавляем их пользователю и авторизуем
						try{
							this.userService.addUser(userId, tempUser[1], messageText);
							this.userService.updateUserCode(userId,tempUser[0])
							const code = this.userService.generateVerificationCode(userId,messageText);
							//console.log(`Сгенерированный код для пользователя ${userId}: ${code}`);
							this.userService.updateUserState(userId, "awaiting_code");
							await ctx.reply(`Ваш номер телефона (${messageText}) успешно получен! ✅`, KEYBOARDS.REMOVE
							);
							await ctx.reply(
								`Мы отправили вам код, введите его для авторизации.`,{
									reply_markup: {
										inline_keyboard: [
											[{ text: "Изменить телефон", callback_data: "change_phone" }]
										]
									}
								}
							);

							setTimeout(async () => {
								// Проверяем условие, чтобы клавиатура появилась только в нужном состоянии
								if (user?.state === 'awaiting_code') {
									await ctx.reply(
										"Введите код для завершения регистрации.",
										KEYBOARDS.CHANGE_PHONE  // Клавиатура с кнопкой "Изменить телефон"
									);
								}
							}, 60000);

						}
						catch (e) {
							await ctx.reply(
								`Ваш номер телефона (${messageText}) успешно получен! ✅ Мы отправили вам код, введите его для завершения регистрации.`,{
									reply_markup: {
										inline_keyboard: [
											[{ text: "Изменить телефон", callback_data: "change_phone" }]
										]
									}
								}
							)
							this.userService.addUser(userId, "", "");
							this.userService.updateUserState(userId, "unauthorized");

							setTimeout(async () => {
								// Проверяем условие, чтобы клавиатура появилась только в нужном состоянии
								if (user.state === "awaiting_code") {
									await ctx.reply(
										"Введите код для завершения регистрации.",
										KEYBOARDS.CHANGE_PHONE  // Клавиатура с кнопкой "Изменить телефон"
									);
								}
							}, 60000);
						}
					} else {
						throw new Error("Данные о пользователе не найдены.");
					}
				} catch (error) {
					console.error("Ошибка при получении карточки пользователя:", error);
					// Запускаем процесс регистрации
					try{const code = this.userService.generateVerificationCode(userId,messageText);
						//console.log(`Сгенерированный код для пользователя ${userId}: ${code}`);
						this.userService.addUser(userId, "", messageText);
						this.userService.updateUserState(userId, "awaiting_code");
						await ctx.reply(`Ваш номер телефона (${messageText}) успешно получен! ✅`, KEYBOARDS.REMOVE
						);
						await ctx.reply(
							`Мы отправили вам код, введите его для завершения регистрации.`,{
								reply_markup: {
									inline_keyboard: [
										[{ text: "Изменить телефон", callback_data: "change_phone" }]
									]
								}
							}
						);
						setTimeout(async () => {
							// Проверяем условие, чтобы клавиатура появилась только в нужном состоянии
							if (user?.state === 'awaiting_code') {
								await ctx.reply(
									"Введите код для завершения регистрации.",
									KEYBOARDS.CHANGE_PHONE  // Клавиатура с кнопкой "Изменить телефон"
								);
							}
						}, 60000);
					}
					catch (e) {
						await ctx.reply(
							`Ваш номер телефона (${messageText}) успешно получен! ✅ Мы отправили вам код, введите его для завершения регистрации.`,{
								reply_markup: {
									inline_keyboard: [
										[{ text: "Изменить телефон", callback_data: "change_phone" }]
									]
								}
							}
						);
						this.userService.addUser(userId, "", "");
						this.userService.updateUserState(userId, "unauthorized");
						setTimeout(async () => {
							// Проверяем условие, чтобы клавиатура появилась только в нужном состоянии
							if (user.state === "awaiting_code") {
								await ctx.reply(
									"Введите код для завершения регистрации.",
									KEYBOARDS.CHANGE_PHONE  // Клавиатура с кнопкой "Изменить телефон"
								);
							}
						}, 60000);
					}
				}
			} else {
				await ctx.reply("Введите корректный номер телефона в международном формате (например, +123456789).");
			}
		}
		else if (user.state === "awaiting_code") {
			// Проверка на нажатие кнопок
			if (messageText === BUTTONS.CHANGE_PHON.text) {
				// Логика для изменения телефона
				this.userService.addUser(userId,'','')
				this.userService.updateUserState(userId, "awaiting_phone");
				this.userService.updateUserCode(userId,"")
				await ctx.reply("Пожалуйста, отправьте ваш номер телефона.", KEYBOARDS.SEND_PHONE);
				return;
			} else if (messageText === BUTTONS.REPEAT_CODE.text) {
				// Логика для повторной отправки кода
				this.userService.resetFailedAttempts(userId);
				this.userService.generateVerificationCode(userId,user.phone)// Сбрасываем счётчик неверных попыток
				await ctx.reply("Запрос на повторный код отправлен. Пожалуйста, проверьте ваш телефон.");
				return;
				// Тут можно добавить вызов функции для отправки нового кода
			} else {
				// Если это не кнопка, то проверяем код
				const isCodeValid = this.userService.verifyCode(userId, messageText);
				//console.log(user.code)
				if (isCodeValid) {
					if (user.code) {
						// Если код верный, далее процесс регистрации или авторизации
						this.userService.updateUserState(userId, "authorized");
						await ctx.reply("Код успешно подтвержден. ✅", KEYBOARDS.AUTHORIZED);
						await ctx.reply(
							"Ваши данные уже загружены\\. Используйте меню ниже:\n\n" +
							"1\\) посмотреть баланс бонусов – *Баланс* ✨\n" +
							"2\\) списать бонусы в магазине, показав сотруднику ваш QR\\-код – *QR код* 🛍️\n" +
							"3\\) посмотреть историю покупок и списаний – *Последние операции* 📒\n" +
							"4\\) выйти из учетной системы бота – *Выйти* ✖️\n" +
							"5\\) изменить вашу почту – *Сменить почту* 📩",
							{
								parse_mode: "MarkdownV2",
							}
						);

						try {
							let auth = await Enterprise.updateCardDetailsByPhone(user.phone, '', userId);
						}
						catch (e) {
							// Обработка ошибок
						}
					}
					else {
						this.userService.updateUserState(userId, "awaiting_name");
						this.userService.resetFailedAttempts(userId); // Сбрасываем счётчик
						await ctx.reply("Код успешно подтвержден. ✅️Введите ваше имя для регистрации в программе лояльности.");
					}
				} else {
					// Увеличиваем счётчик неверных попыток
					const attemptsLeft = this.userService.incrementFailedAttempts(userId);

					if (attemptsLeft > 0) {
						await ctx.reply(
							`Неверный код. У вас осталось ${attemptsLeft} ${attemptsLeft === 1 ? "попытка" : "попытки"}.`
						);
					} else {
						// Сбрасываем пользователя к начальному состоянию
						this.userService.updateUserState(userId, "awaiting_phone");
						this.userService.resetFailedAttempts(userId); // Сбрасываем счётчик
						await ctx.reply(
							"Вы превысили количество попыток ввода кода. Регистрация началась заново. Пожалуйста, отправьте ваш номер телефона.",
							KEYBOARDS.SEND_PHONE
						);
					}
				}
			}
		}
		else if (user.state === "awaiting_name") {
			// Проверяем имя перед сохранением
			if (!isValidUserName(messageText)) {
				await ctx.reply("Некорректное имя! Используйте только буквы, пробелы и дефисы, длина от 2 до 50 символов.");
				return;
			}
			this.userService.addUser(userId, messageText, user.phone);
			this.userService.updateUserState(userId, "awaiting_mail");
			await ctx.reply(`Спасибо, ${messageText}! Теперь осталось только ввести почту`, KEYBOARDS.REMOVE);
		}
		else if (user.state === "awaiting_mail") {
			try {
				// Проверяем формат email
				if (!isValidEmailFormat(messageText)) {
					await ctx.reply(`Некорректный формат email. Введите корректный email.`);
					return;
				}

				// Проверяем MX-запись
				const isDomainValid = await hasMxRecord(messageText);
				if (!isDomainValid) {
					await ctx.reply(`Почтовый сервер для указанного email не найден. Введите корректный email.`);
					return;
				}

				// Если email валиден — продолжаем регистрацию
				let regUser = await Enterprise.addNewCard(user.name, user.phone, messageText, user.id);
				this.userService.updateUserCode(userId, regUser);
				this.userService.updateUserState(userId, "authorized");
				await ctx.reply(`Поздравляем, Имя! Регистрация завершена! 🎉`, KEYBOARDS.AUTHORIZED);
			} catch (e) {
				await ctx.reply(`Регистрация не завершена, попробуйте позже.`);
				this.userService.updateUserState(userId, "unauthorized");
				this.userService.addUser(userId, "", "");
			}
		}
		else if (user.state === "authorized") {
			if (messageText === BUTTONS.LOGOUT.text) {
				this.userService.updateUserState(userId, "awaiting_phone");

				await ctx.reply(
					"Вы успешно вышли из системы. Для повторной регистрации используйте команду /start.",
					KEYBOARDS.REMOVE
				);
			} else {

				await ctx.reply("Вы уже авторизованы! Выберите /start для продолжения работы?");
			}
		}
		else {

			await ctx.reply("Произошла ошибка. Попробуйте начать с команды /start.");
		}
	}

	public async handleLogout(ctx: Context): Promise<void> {
		const userId = ctx.from?.id;

		if (!userId) return;

		const user = this.userService.getUserInfo(userId);

		if (!user || user.state !== "authorized") {
			await ctx.reply("Вы не авторизованы или уже вышли из системы.");
			return;
		}

		this.userService.removeUser(userId); // Удаляем пользователя из хранилища

		await ctx.reply(
			"Вы успешно вышли из системы. Для повторной регистрации используйте команду /start.",
			KEYBOARDS.REMOVE
		);
	}
	public async handlePhone(ctx: Context): Promise<void> {
		const userId = ctx.from?.id;
		await ctx.answerCbQuery();
		if (!userId) return;
		const user = this.userService.getUserInfo(userId);
		if (!user) {
			await ctx.reply("произошла критическая ошибка");
			return;
		}
		this.userService.addUser(userId,'','')
		this.userService.updateUserState(userId, "awaiting_phone");
		this.userService.updateUserCode(userId,"")
		await ctx.reply("Пожалуйста, отправьте ваш номер телефона.", KEYBOARDS.SEND_PHONE);
	}
}
