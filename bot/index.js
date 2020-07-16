const Discord = require('discord.js');
const Reddit = require('../reddit/index.js');
const state = require('./enum/state.js');
const type = require('./enum/type.js');
const {sendCreatorMessage, removeMessage} = require('../common/message.js');
const path = require('path'); 
const dotenv = require('dotenv');

env = dotenv.config({path: path.join(__dirname, '.env')});
const bot = new Discord.Client();
const reddit = new Reddit(bot);

bot.on("message", msg => {
    if(msg != "undefined" && msg.author.bot) reddit.invoke(msg, state.MESSAGE, type.BOT);

    try {
        reddit.invoke(msg, state.MESSAGE, type.USER);
    } catch(e) {
        sendCreatorMessage(
            bot, 
            `***GLOBAL ERROR!***`,
            `A crash was avoided by catching a global error on the MESSAGE event. The error is as following:\n${e}`
        );
    }
});

bot.on('guildMemberAdd', member => {
    if(msg.author.bot) return;

    try {
        reddit.invoke(member, state.GUILD_MEMBER_ADD, type.USER);
    } catch(e) {
        sendCreatorMessage(
            bot, 
            `***GLOBAL ERROR!***`,
            `A crash was avoided by catching a global error on the MESSAGE event. The error is as following:\n${e}`
        );
    }
});

bot.on('guildMemberRemove', member => {
    if(msg.author.bot) return;

    try {
        reddit.invoke(member, state.GUILD_MEMBER_REMOVE, type.USER);
    } catch(e) {
        sendCreatorMessage(
            bot, 
            `***GLOBAL ERROR!***`,
            `A crash was avoided by catching a global error on the MESSAGE event. The error is as following:\n${e}`
        );
    }
});

bot.login(process.env.DISCORD_TOKEN);