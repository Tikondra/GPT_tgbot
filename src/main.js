import { Telegraf, session } from 'telegraf'
import { message } from 'telegraf/filters'
import { code } from 'telegraf/format'
import config from 'config'
import { ogg } from './ogg.js'
import { openAi } from './openAi.js'

const INITIAL_SESSION = {
    messages: []
}

const bot = new Telegraf(config.get('TELEGRAM_TOKEN'))

bot.use(session())

bot.command('new', async (ctx) => {
    ctx.session = INITIAL_SESSION
    await ctx.reply('Жду запрос')
})

bot.command('start', async (ctx) => {
    ctx.session = INITIAL_SESSION
    await ctx.reply('Жду запрос')
})

bot.on(message('voice'), async (ctx) => {
    ctx.session ??= INITIAL_SESSION
    try {
        await ctx.reply(code('Wait please...'))
        const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
        const userId = String(ctx.message.from.id)
        const messageId = String(ctx.message.message_id)
        const oggPath = await ogg.create(link.href, `${userId}-${messageId}`)
        const mp3Path = await ogg.toMp3(oggPath, `${userId}-${messageId}`)

        const text = await openAi.transcription(mp3Path)
        await ctx.reply(code(`Ваш запрос: ${text}`))
        ctx.session.messages.push({ role: openAi.roles.USER, content: text })

        const response = await openAi.chat(ctx.session.messages)
        ctx.session.messages.push({ role: openAi.roles.ASSISTANT, content: response.content })

        await ctx.reply(response.content)
    } catch (e) {
        console.log('Error while voice message', e.message)
    }
})

bot.on(message('text'), async (ctx) => {
    ctx.session ??= INITIAL_SESSION
    try {
        await ctx.reply(code('Wait please...'))

        ctx.session.messages.push({ role: openAi.roles.USER, content: ctx.message.text })
        const response = await openAi.chat(ctx.session.messages)
        ctx.session.messages.push({ role: openAi.roles.ASSISTANT, content: response.content })

        await ctx.reply(response.content)
    } catch (e) {
        console.log('Error while voice message', e.message)
    }
})

bot.launch()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
