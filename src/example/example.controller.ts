import express, { Request, Response, Router } from 'express'
import { ExampleService } from '././example.service'
export const exampleRouter: Router = Router()

exampleRouter.use(express.json())
exampleRouter.use(express.urlencoded({ extended: true }))
exampleRouter.post('/', (req: Request, res: Response): void => {
	const exampleService = new ExampleService()
	console.log(req.body)
	res.sendStatus(200)
})
