"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const airgram_1 = require("airgram");
// const alice = new Discord.Client();
/* alice.login("NTg4NzUyODA1MDkxODY4Njgy.XQJsxw.w2yJXwADrDJVHCYWULBePmWPev0");

alice.on('ready', () => {
    console.log('Oi! Eu sou a Alic3 e estou pronta para a ação!');
}) */
const airgram = new airgram_1.Airgram({
    apiId: 2075902,
    apiHash: 'f08e37dbfd9f37b16d2378d808d266f9',
    logVerbosityLevel: 0
});
airgram.use(new airgram_1.Auth({
    code: () => airgram_1.prompt(`Please enter the secret code:\n`),
    phoneNumber: () => airgram_1.prompt(`Please enter your phone number:\n`),
}));
void (async () => {
    const me = airgram_1.toObject(await airgram.api.getMe());
    console.log(`[me]`, me);
});
// Getting all updates
airgram.use((ctx, next) => {
    if ('update' in ctx) {
        //   console.log(`[all updates][${ctx._}]`, JSON.stringify(ctx.update))
    }
    return next();
});
// Getting new messages
airgram.on('updateNewMessage', async ({ update }, next) => {
    const { message } = update;
    console.log('[new message]', message);
    return next();
});
//# sourceMappingURL=index.js.map