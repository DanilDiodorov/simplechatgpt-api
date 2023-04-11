const { OpenAIApi, Configuration } = require('openai')
const server = require('http').createServer()
const io = require('socket.io')(server, {
    cors: {
        origin: '*',
    },
})
require('dotenv').config()

let users = []

// Установите ключ API OpenAI

const openaiapi = new OpenAIApi(
    new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
    })
)

// Создайте функцию для отправки запроса к GPT и получения ответа
const generateResponse = async (prompt, id) => {
    let messages
    users.map((user) => {
        if (user.id === id) {
            messages = user.messages
        }
    })
    messages.push({ role: 'user', content: prompt.trim() })
    try {
        const response = await openaiapi.createChatCompletion({
            model: 'gpt-3.5-turbo',
            messages,
        })
        messages.push({
            role: 'assistant',
            content: response.data.choices[0].message.content,
        })
        users.map((user) => {
            if (user.id === id) {
                user.messages = messages
            }
        })
        return response.data.choices[0].message.content
    } catch {
        return 'Извините произошла ошибка на сервере.\n\n Попробуйте еще раз.'
    }
}

// Событие подключения клиента к серверу
io.on('connection', (socket) => {
    const system = 'Тебя зовут Карен и ты должнем помогать людям'
    users.push({
        id: socket.id,
        messages: [
            {
                role: 'system',
                content: system,
            },
        ],
    })
    console.log(`user connected with id ${socket.id}`)
    // Обработка события отправки сообщения клиентом
    socket.on('message', async (message) => {
        console.log(`Message received from client: ${message}`)

        // Отправка запроса к GPT для получения ответа
        const response = await generateResponse(message, socket.id)
        // Отправка ответа клиенту
        console.log(`Message sended to client: ${response}`)
        socket.emit('message', response)
    })
    socket.on('delete', () => {
        users.map((user) => {
            if (user.id === socket.id) {
                user.messages = [
                    {
                        role: 'system',
                        content: system,
                    },
                ]
            }
        })
    })
    // Событие отключения клиента от сервера
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`)
        users = users.filter((user) => {
            return user.id !== socket.id
        })
    })
})

// Запуск сервера на порту 3000
server.listen(10000, () => {
    console.log('Server listening on port 10000')
})
