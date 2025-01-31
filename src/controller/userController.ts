import { Context } from "telegraf";
import { UserService } from "../service/UserService";
import { Enterprise } from '../class/1cServer'
import * as path from 'path'

const BUTTONS = {
	SEND_PHONE: {
		text: "Отправить номер телефона",
		request_contact: true,
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
};

const KEYBOARDS = {
	SEND_PHONE: {
		reply_markup: {
			keyboard: [[BUTTONS.SEND_PHONE]],
			resize_keyboard: true,
			one_time_keyboard: true,
		},
	},
	AUTHORIZED: {
		reply_markup: {
			keyboard: [
				[BUTTONS.BALANCE, BUTTONS.QR_CODE],
				[BUTTONS.LAST_OPERATIONS, BUTTONS.LOGOUT],
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
				"Добро пожаловать! Для начала работы предоставьте ваш номер телефона.",
				KEYBOARDS.SEND_PHONE
			);
		} else if (user.state === "awaiting_phone") {
			await ctx.reply(
				"Вы еще не завершили регистрацию. Пожалуйста, предоставьте ваш номер телефона.",
				KEYBOARDS.SEND_PHONE
			);
		} else if (user.state === "awaiting_code") {
			await ctx.reply("Пожалуйста, введите код, отправленный на ваш номер телефона.");
		} else if (user.state === "authorized") {
			await ctx.reply("Вы авторизованы! Чем я могу вам помочь?", KEYBOARDS.AUTHORIZED);
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
							this.userService.addUser(userId, tempUser[1], contact.phone_number);
							this.userService.updateUserCode(userId,tempUser[0])
							const code = this.userService.generateVerificationCode(userId);
							console.log(`Сгенерированный код для пользователя ${userId}: ${code}`);
							this.userService.updateUserState(userId, "awaiting_code");

							await ctx.reply(
								`Ваш номер телефона (${contact.phone_number}) успешно получен. Мы отправили вам код, введите его для авторизации.`
							);
						} else {
							throw new Error("Данные о пользователе не найдены.");
						}
					} catch (error) {
						console.error("Ошибка при получении карточки пользователя:", error);
						// Запускаем процесс регистрации
						const code = this.userService.generateVerificationCode(userId);
						console.log(`Сгенерированный код для пользователя ${userId}: ${code}`);
						this.userService.addUser(userId, "", contact.phone_number);
						this.userService.updateUserState(userId, "awaiting_code");

						await ctx.reply(
							`Ваш номер телефона (${contact.phone_number}) успешно получен. Мы отправили вам код, введите его для завершения регистрации.`
						);
					}
				} else if (user && user.state === "authorized") {
					await ctx.reply("Вы уже авторизованы! Чем я могу вам помочь?");
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
						const balance = await Enterprise.getBalanceByPhone(user.phone);
						await ctx.reply(`Ваш баланс: ${balance} ₽`);
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
						console.log(history)
						if (!history.length) {
							await ctx.reply("История пуста.");
							return;
						}

						let escapeMarkdown = (text:any) => {
							return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");// Экранирование спецсимволов MarkdownV2
						};

						let message = "📜 *Ваша история бонусов:*\n\n";

						history.forEach((entry:any) => {
							const date = new Date(entry.date).toLocaleDateString("ru-RU"); // Форматируем дату
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
					this.userService.updateUserState(userId, "awaiting_phone");
					await ctx.reply(
						"Вы успешно вышли из системы. Для повторной регистрации используйте команду /start.",
						KEYBOARDS.REMOVE
					);
					return;
				default:
					await ctx.reply("Вы уже авторизованы! Чем я могу вам помочь?", KEYBOARDS.AUTHORIZED);
					return;
			}
		}

		// Проверяем состояние пользователя
		if (user.state === "awaiting_phone") {
			// Проверяем, является ли сообщение корректным номером телефона
			const phoneRegex = /^\+?[1-9]\d{1,14}$/; // Стандартный формат E.164
			if (phoneRegex.test(messageText)) {
				try {
					let tempUser = await Enterprise.getCardByPhone(messageText);

					if (tempUser) {
						// Если получили данные, добавляем их пользователю и авторизуем
						this.userService.addUser(userId, tempUser[1], messageText);
						this.userService.updateUserCode(userId,tempUser[0])
						const code = this.userService.generateVerificationCode(userId);
						console.log(`Сгенерированный код для пользователя ${userId}: ${code}`);
						this.userService.updateUserState(userId, "awaiting_code");
						await ctx.reply(
							`Ваш номер телефона (${messageText}) успешно получен. Мы отправили вам код, введите его для авторизации.`
						);
					} else {
						throw new Error("Данные о пользователе не найдены.");
					}
				} catch (error) {
					console.error("Ошибка при получении карточки пользователя:", error);
					// Запускаем процесс регистрации
					const code = this.userService.generateVerificationCode(userId);
					console.log(`Сгенерированный код для пользователя ${userId}: ${code}`);
					this.userService.addUser(userId, "", messageText);
					this.userService.updateUserState(userId, "awaiting_code");

					await ctx.reply(
						`Ваш номер телефона (${messageText}) успешно получен. Мы отправили вам код, введите его для завершения регистрации.`
					);
				}
			} else {
				await ctx.reply("Введите корректный номер телефона в международном формате (например, +123456789).");
			}
		} else if (user.state === "awaiting_code") {
			const isCodeValid = this.userService.verifyCode(userId, messageText);

			if (isCodeValid) {
				if (user.code) {
					console.log(user.code)
					// Если код верный, далее процесс регистрации или авторизации
					this.userService.updateUserState(userId, "authorized");
					await ctx.reply("Код подтвержден. Вы авторизованы");
					try {
						let auth = await Enterprise.updateCardDetailsByPhone(user.phone,'',userId)
					}
					catch (e){

					}
				}
				else{
				this.userService.updateUserState(userId, "awaiting_name");
				this.userService.resetFailedAttempts(userId); // Сбрасываем счётчик
				await ctx.reply("Код успешно подтвержден. Теперь введите ваше имя для регистрации.");}
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
		} else if (user.state === "awaiting_name") {
			
			this.userService.addUser(userId, messageText, user.phone);
			this.userService.updateUserState(userId, "awaiting_mail");
			await ctx.reply(`Спасибо, ${messageText}! Теперь введите почту`, KEYBOARDS.REMOVE);
		}
		else if (user.state === "awaiting_mail") {
			try {
				let regUser= await Enterprise.addNewCard(user.name,user.phone,messageText,user.id)
				this.userService.updateUserCode(userId,regUser)
				this.userService.updateUserState(userId, "authorized");
				await ctx.reply(
					`Регистрация завершена, можете продолжать работу`
				);
			}
		catch (e) {
			await ctx.reply(
				`Регистрация не завершена попробуйте позже.`
			);
			this.userService.updateUserState(userId,"unauthorized")
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
				await ctx.reply("Вы уже авторизованы! Чем я могу вам помочь?");
			}
		} else {
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
}
