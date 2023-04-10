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
}

// Событие подключения клиента к серверу
io.on('connection', (socket) => {
    users.push({
        id: socket.id,
        messages: [
            {
                role: 'system',
                content:
                    'Тебя зовут Карен. Отвечай как психолог, твоя задача помогать людям и утешать их. На вопрос типа "кто ты?" отвечай, что ты психолог. Предаставляйся психологом. Данил твой создатель',
            },
        ],
    })
    console.log(users)
    // Обработка события отправки сообщения клиентом
    socket.on('message', async (message) => {
        console.log(`Message received from client: ${message}`)

        // Отправка запроса к GPT для получения ответа
        const response = await generateResponse(message, socket.id)

        // Отправка ответа клиенту
        console.log(response)
        socket.emit('message', response)
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
