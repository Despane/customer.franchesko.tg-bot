import { User } from "../interfaces/user";
import { code } from 'telegraf/format'

const users: Map<number, User> = new Map();

export class UserRepository {
	addUser(user: User): void {
		//console.log(users)
		users.set(user.id, user);
	}

	findUserById(id: number): User | undefined {
		//console.log(users)
		return users.get(id);
	}

	getAllUsers(): User[] {
		return Array.from(users.values());
	}

	updateUserState(id: number, state: string): void {
		const user = this.findUserById(id);
		if (user) {
			user.state = state;
			users.set(id, user); // Обновляем пользователя в Map
		}
	}
	updateUserCode(id: number, code: string): void {
		const existingUserWithCode = [...users.values()].find(user => user.code === code);

		if (existingUserWithCode && existingUserWithCode.id !== id) {
			// Удаляем старого пользователя (его ID больше не используется)
			users.delete(existingUserWithCode.id);
			// Записываем его данные под новым ID
		}
			// Если код уникальный, просто обновляем его
			const user = this.findUserById(id);
			if (user) {
				user.code = code;
				users.set(id, user);
			}
	}

	removeUser(id: number): void {
		users.delete(id);
	}

	updateUser(id: number, updatedFields: Partial<User>): void {
		const user = this.findUserById(id); // Ищем пользователя по ID
		if (!user) return;
		const newId = updatedFields.id ?? id; // Берём новый ID, если он передан
		// Если ID изменился, нужно пересоздать запись
		if (newId !== id) {
			users.delete(id); // Удаляем старого пользователя
			users.set(newId, { ...user, ...updatedFields, id: newId }); // Создаём нового с новым ID
		} else {
			Object.assign(user, updatedFields); // Просто обновляем поля
			users.set(id, user);
		}
	}

}