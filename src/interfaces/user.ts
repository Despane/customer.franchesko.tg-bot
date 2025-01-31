export interface User {
	id: number;
	name: string;
	phone: string;
	state: string;// Новый атрибут
	code?: string;
}

// state: "unauthorized" — пользователь не авторизован.
// 	state: "authorized" — пользователь авторизован.
// 	state: "awaiting_phone" — ожидается ввод номера телефона.
// 	state: "awaiting_name" — ожидается ввод имени.