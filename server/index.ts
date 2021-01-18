import Discord from 'discord.js';
import { Airgram, Auth, prompt, toObject } from 'airgram'

// const alice = new Discord.Client();


/* alice.login("NTg4NzUyODA1MDkxODY4Njgy.XQJsxw.w2yJXwADrDJVHCYWULBePmWPev0");

alice.on('ready', () => {
    console.log('Oi! Eu sou a Alic3 e estou pronta para a ação!');
}) */

const airgram = new Airgram({
    apiId: 2075902,
    apiHash: 'f08e37dbfd9f37b16d2378d808d266f9',
    logVerbosityLevel: 0
  })
  
  airgram.use(new Auth({
    code: () => prompt(`Please enter the secret code:\n`),
    phoneNumber: () => prompt(`Please enter your phone number:\n`),
  }))
  
  void (async () => {
    console.log(`[ESSES DADOS DO LOGIN]`)
    const me = toObject(await airgram.api.getMe())
  })

  // Getting all updates
airgram.use((ctx, next) => {
    if ('update' in ctx) {
      // console.log(`[all updates][${ctx._}]`, JSON.stringify(ctx.update))
    }
    return next()
  })
  
  // Getting new messages
  airgram.on('updateNewMessage', async ({update: {message}}, next) => {
    console.log("########################")
    console.log("ESSE É O UPDATE ########")
    console.log("########################")
    // console.log('[new message]', message)
    // console.log('[CONTENT]', message.content)
    console.log('[SENDER]', message.sender)
    return next()
  })
  // Getting new messages
  airgram.on('updateUserStatus', async (props , next) => {
    console.log("USER STATUS ##################################################################################")
    console.log(props)
    return next()
  })

  airgram.on('updateUser', async (props , next) => {
    console.log("USER UPDATE")
    console.log(props)
    return next()
  })