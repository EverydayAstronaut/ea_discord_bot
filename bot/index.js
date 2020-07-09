const Discord = require('discord.js');
const Reddit = require('../reddit/index.js');
const state = require('./enum/state.js');
const sendCreatorMessage = require('../common/message.js');
const dotenv = require('dotenv');

env = dotenv.config();
const bot = new Discord.Client();
const reddit = new Reddit(bot);

bot.on("message", msg => {
    if(msg.author.bot) return;

    try {
        reddit.invoke(msg, state.MESSAGE);
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
        reddit.invoke(member, state.GUILD_MEMBER_ADD);
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
        reddit.invoke(member, state.GUILD_MEMBER_REMOVE);
    } catch(e) {
        sendCreatorMessage(
            bot, 
            `***GLOBAL ERROR!***`,
            `A crash was avoided by catching a global error on the MESSAGE event. The error is as following:\n${e}`
        );
    }
});

bot.login(process.env.DISCORD_TOKEN);