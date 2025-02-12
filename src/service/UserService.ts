import { User } from "../interfaces/user";
import { UserRepository } from "../repository/UserRepository";
import axios from 'axios'

const userRepository = new UserRepository();

export class UserService {
	private verificationCodes: Map<number, string> = new Map();

	addUser(id: number, name: string, phone: string): void {

		// Проверяем, есть ли пользователь с таким ID
		const userExists = userRepository.findUserById(id);

		if (userExists) {
			// Если пользователь с таким ID найден, обновляем его данные
			userRepository.updateUser(id, { name, phone });
		} else {
			// Добавляем нового пользователя
			userRepository.addUser({ id, name, phone, state: "unauthorized" });
		}
	}

	getUserInfo(id: number): User | undefined {
		return userRepository.findUserById(id);
	}

	updateUserState(id: number, state: string): void {
		userRepository.updateUserState(id, state);
	}

	getUserState(id: number): string | undefined {
		const user = userRepository.findUserById(id);
		return user?.state;
	}
	updateUserCode(id: number, code: string): void {
		userRepository.updateUserCode(id, code);
	}
	// Метод для генерации кода подтверждения
	generateVerificationCode(userId: number, phone: string): string {
		const code = Math.floor(100000 + Math.random() * 900000).toString(); // Генерация 6-значного кода
		this.verificationCodes.set(userId, code);
		//console.log(code)
		const smsToken = process.env.SMS_TOKEN; // Получаем токен из .env
		const message = `Ваш код подтверждения: ${code}`;

		axios.get("https://sms.ru/sms/send", {
			params: {
				api_id: "BAADB095-E9A7-0E3F-91D5-77A094FA9574",
				to: phone,
				msg: message,
				json: 1
			}
		})
			.then(response => {
				//console.log("SMS отправлено:", response.data);
			})
			.catch(error => {
				console.error("Ошибка при отправке SMS:", error);
			});

		return code;
	}

	// Метод для проверки кода подтверждения
	verifyCode(userId: number, code: string): boolean {
		const storedCode = this.verificationCodes.get(userId);
		if (storedCode === code) {
			this.verificationCodes.delete(userId); // Удаляем код после успешной проверки
			return true;
		}
		return false;
	}
	private failedAttempts: Record<number, number> = {};

	public incrementFailedAttempts(userId: number): number {
		if (!this.failedAttempts[userId]) {
			this.failedAttempts[userId] = 0;
		}
		this.failedAttempts[userId] += 1;

		const maxAttempts = 3;
		return maxAttempts - this.failedAttempts[userId];
	}

	public resetFailedAttempts(userId: number): void {
		delete this.failedAttempts[userId];
	}
	removeUser(id: number): void {
		// Удаляем пользователя из репозитория
		userRepository.removeUser(id);

		// Удаляем верификационный код
		this.verificationCodes.delete(id);

		// Удаляем счётчик неудачных попыток
		delete this.failedAttempts[id];
	}

}