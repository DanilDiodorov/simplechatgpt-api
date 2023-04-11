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
    let messages = []
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

const findUser = (id) => {
    let finded = false
    users.map((user) => {
        if (user.id === id) finded = true
    })
    return finded
}

// Событие подключения клиента к серверу
io.on('connection', (socket) => {
    const system =
        'Твое имя Карен. И ты должнем помогать людям. На вопрос как тебя зовут говори, что тебя зовут Карен'

    // console.log(`user connected with id ${socket.id}`)
    // Обработка события отправки сообщения клиентом
    socket.on('message', async ({ uid, text }) => {
        if (!findUser(uid)) {
            users.push({
                id: uid,
                messages: [
                    {
                        role: 'system',
                        content: system,
                    },
                ],
            })
            console.log(`User is created with id ${uid}`)
            console.log(users)
        }

        console.log(`Message received from client: ${text}`)

        // Отправка запроса к GPT для получения ответа
        const response = await generateResponse(text, uid)
        // Отправка ответа клиенту
        console.log(`Message sended to client: ${response}`)
        io.emit('message', { message: response, uid })
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

    socket.on('deleteUser', (uid) => {
        users = users.filter((user) => {
            return user.id !== uid
        })
        console.log(`User is deleted with id ${uid}`)
    })
    // Событие отключения клиента от сервера
    socket.on('disconnect', () => {
        // console.log(`Client disconnected: ${socket.id}`)
    })
})

// Запуск сервера на порту 3000
server.listen(10000, () => {
    console.log('Server listening on port 10000')
})
