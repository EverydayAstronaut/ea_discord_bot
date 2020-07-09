const Discord = require('discord.js');
const Reddit = require('../reddit/index.js');
const state = require('./enum/state.js');
const dotenv = require('dotenv');

env = dotenv.config();
const bot = new Discord.Client();
const reddit = new Reddit(bot);

bot.on("message", msg => {
    if(msg.author.bot) return;
    reddit.invoke(msg, state.MESSAGE);
});

bot.on('guildMemberAdd', member => {
    reddit.invoke(member, state.GUILD_MEMBER_ADD);
});

bot.on('guildMemberRemove', member => {
    reddit.invoke(member, state.GUILD_MEMBER_REMOVE);
});

bot.login(process.env.DISCORD_TOKEN);