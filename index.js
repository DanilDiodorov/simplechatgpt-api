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
        const response = await openaiapi.createChatCompletion(
            {
                model: 'gpt-3.5-turbo',
                messages,
                temperature: 0,
                stream: true,
            },
            { responseType: 'stream' }
        )
        users.map((user) => {
            if (user.id === id) {
                user.messages = messages
            }
        })
        return response
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

const checkSending = (id) => {
    let senidng
    users.map((user) => {
        if (user.id === id) senidng = user.senidng
    })
    return senidng
}

const changeSending = (id, to) => {
    users.map((user) => {
        if (user.id === id) user.senidng = to
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
    const system = `Твое имя Карен. Веди себя как Карен, ты должнем помогать людям На вопрос как тебя зовут говори, что тебя зовут Карен. Запомни, что сегодняшняя дата ${getDate()}. На вопрос кто твой создатель отвечай Данил`
    // console.log(`user connected with id ${socket.id}`)
    // Обработка события отправки сообщения клиентом
    socket.on('message', async ({ uid, text }, callBack) => {
        if (!findUser(uid)) {
            users.push({
                id: uid,
                status: 'canSend',
                sending: false,
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
            callBack('recieved')
            // Отправка запроса к GPT для получения ответа

            // const response = await generateResponse(text, uid)

            const response = await generateResponse(text, uid)

            // Отправка ответа клиенту
            changeSending(uid, true)

            let inProcces = true

            let fullRes = ''
            response.data.on('data', (data) => {
                if (inProcces) {
                    const lines = data
                        .toString()
                        .split('\n')
                        .filter((line) => line.trim() !== '')
                    for (const line of lines) {
                        const message = line.replace(/^data: /, '')
                        if (message === '[DONE]' || !checkSending(uid)) {
                            users.map((user) => {
                                if (user.id === uid) {
                                    user.messages = [
                                        ...user.messages,
                                        {
                                            role: 'assistant',
                                            content: fullRes,
                                        },
                                    ]
                                }
                            })

                            io.emit('message', { message: null, uid })
                            inProcces = false
                            return
                        } else {
                            const parsed = JSON.parse(message)
                            if (parsed.choices[0].delta.content !== undefined) {
                                try {
                                    io.emit('message', {
                                        message:
                                            parsed.choices[0].delta.content,
                                        uid,
                                    })
                                } catch (e) {
                                    console.log(e)
                                }
                                fullRes += parsed.choices[0].delta.content
                            }
                        }
                    }
                }
            })
        }
    })

    socket.on('recieved', (uid) => {
        changeStatus(uid, 'canSend')
    })

    socket.on('stop', (uid) => {
        changeSending(uid, false)
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
