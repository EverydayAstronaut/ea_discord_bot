const sendCreatorMessage = (discord, title, msg) => {
    const content = `\n\n***${title}*** \n${msg}`
    discord.guilds.cache.entries().next().value[1].members.cache.get("199157185320583168").send(content);
}

module.exports = sendCreatorMessage;