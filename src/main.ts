import express, { Express, Request, Response } from 'express'
import { exampleRouter} from './example/example.controller'
const main: Express = express()
const port: number = 3000

main.get('/', (req: Request, res: Response): void => {
	res.send('Server is working')
})
main.use('/example', exampleRouter)

main.listen(port, (): void => {
	console.log('Server started on port ' + port)
})