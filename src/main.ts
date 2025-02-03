import { Telegraf } from "telegraf";
import * as dotenv from "dotenv";
import express, {RequestHandler } from 'express'
import { UserService } from "./service/UserService";
import { UserController } from "./controller/userController";

// Загружаем переменные окружения из .env
dotenv.config();

// Создаем экземпляры сервисов и контроллеров
const userService = new UserService();
const userController = new UserController(userService);

// Инициализация Express
const app = express();
const port = process.env.PORT || 3000;

// Инициализация бота
const bot = new Telegraf("8085409440:AAGuxGaLyXqHUs385-oF8wLTlcVWQzw6FZA");

// Используем middleware для обработки запросов от Telegram
app.use(express.json());
const authMiddleware: RequestHandler = (req, res, next) => {
	const authHeader = req.headers["authorization"]; // Используем индексную нотацию
	if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
		return res.status(401).send("Unauthorized");
	}

	const token = authHeader.split(" ")[1];
	if (token !== "28c777ffd217109961b5fb3a11b5b881aea2aa6af406ac7cc2c8dac4ddd0be11") {
		return res.status(403).send("Forbidden");
	}

	next();
};
// Обработчик для webhook от Telegram
app.post("/webhook", (req, res) => {
	bot.handleUpdate(req.body, res);
	res.status(200).send("OK");
});
app.post("/sendMessage",authMiddleware, async (req, res) => {
	const { chatId, message } = req.body;

	if (!chatId || !message) {
		return res.status(400).send("Chat ID and message are required.");
	}

	try {
		await bot.telegram.sendMessage(chatId, message);
		res.status(200).send("Message sent successfully.");
	} catch (error) {
		console.error(error);
		res.status(500).send("Failed to send message.");
	}
});

// Новый маршрут для отправки кода в чат
app.post("/sendCode",authMiddleware, async (req, res) => {
	const { chatId, code } = req.body;

	if (!chatId || !code) {
		return res.status(400).send("Chat ID and code are required.");
	}

	try {
		await bot.telegram.sendMessage(chatId, `Ваш код :${code}`);
		res.status(200).send("Code sent successfully.");
	} catch (error) {
		console.error(error);
		res.status(500).send("Failed to send code.");
	}
});
// Настроим вебхук для бота
const webhookUrl = `https://10a2f833a86eb8.lhr.life/webhook`;

bot.launch();

// Команды и обработчики бота
bot.command("start", (ctx) => userController.handleStart(ctx));
bot.command("logout", (ctx) => userController.handleLogout(ctx));
bot.on("contact", (ctx) => userController.handleContact(ctx));
bot.on("text", (ctx) => userController.handleText(ctx));

// Запуск сервера Express
app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});

// Обработка SIGINT и SIGTERM
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
