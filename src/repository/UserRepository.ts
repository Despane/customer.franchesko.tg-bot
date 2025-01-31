import { User } from "../interfaces/user";
import { code } from 'telegraf/format'

const users: Map<number, User> = new Map();

export class UserRepository {
	addUser(user: User): void {
		console.log(user.id)
		users.set(user.id, user);
	}

	findUserById(id: number): User | undefined {
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
		const user = this.findUserById(id);
		if (user) {
			user.code = code;
			users.set(id, user); // Обновляем пользователя в Map
		}
	}
	removeUser(id: number): void {
		users.delete(id);
	}

	updateUser(id: number, updatedFields: Partial<User>): void {
		const user = this.findUserById(id);
		if (user) {
			Object.assign(user, updatedFields);
			users.set(id, user); // Обновляем пользователя в Map
		}
	}
}