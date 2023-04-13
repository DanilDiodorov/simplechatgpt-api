const { OpenAIApi, Configuration } = require('openai')
const server = require('http').createServer()
const io = require('socket.io')(server, {
    cors: {
        origin: '*',
    },
})
require('dotenv').config()

let users = []
let messagesInterval = []

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

const checkStatus = (id) => {
    let status
    users.map((user) => {
        if (user.id === id) status = user.status
    })
    return status
}

const changeStatus = (id, to) => {
    users.map((user) => {
        if (user.id === id) user.status = to
    })
}

const getDate = () => {
    let today = new Date()
    let dd = String(today.getDate()).padStart(2, '0')
    let mm = String(today.getMonth() + 1).padStart(2, '0') //January is 0!
    let yyyy = today.getFullYear()
    return dd + '.' + mm + '.' + yyyy
}

// Событие подключения клиента к серверу
io.on('connection', (socket) => {
    const system = `Твое имя Карен. Веди себя как Карен, ты должнем помогать людям На вопрос как тебя зовут говори, что тебя зовут Карен. Запомни, что сегодняшняя дата ${getDate()}`

    // console.log(`user connected with id ${socket.id}`)
    // Обработка события отправки сообщения клиентом
    socket.on('message', async ({ uid, text }, callBack) => {
        if (!findUser(uid)) {
            users.push({
                id: uid,
                status: 'canSend',
                messages: [
                    {
                        role: 'system',
                        content: system,
                    },
                ],
            })
            console.log(`User is created with id ${uid}`)
            console.log(`Users on server: ${users.length}`)
        }

        if (checkStatus(uid) === 'canSend') {
            changeStatus(uid, 'sending')
            console.log(`Message received from client: ${text}`)
            callBack('recieved')
            // Отправка запроса к GPT для получения ответа
            const response = await generateResponse(text, uid)
            // Отправка ответа клиенту
            console.log(`Message sended to client: ${response}`)
            messagesInterval.push({
                uid,
                interval: setInterval(() => {
                    io.emit('message', { message: response, uid })
                }, 500),
            })
        }
    })

    socket.on('recieved', (uid) => {
        messagesInterval.map((ints) => {
            if (ints.uid === uid) {
                clearInterval(ints.interval)
            }
        })
        messagesInterval = messagesInterval.filter((ints) => {
            return ints.uid !== uid
        })
        changeStatus(uid, 'canSend')
    })

    socket.on('delete', (uid) => {
        users.map((user) => {
            if (user.id === uid) {
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
