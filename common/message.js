const sendCreatorMessage = (discord, title, msg) => {
    const content = `\n\n***${title}*** \n${msg}`
    discord.guilds.cache.entries().next().value[1].members.cache.get("199157185320583168").send(content);
}

const checkDeletePermission = (msg) => {
    const pinned = msg.pinned;
    return !(pinned);
}

const removeMessage = (msg, reason) => {
    if(checkDeletePermission(msg)) {
        console.log(`REMOVING MESSAGE[${reason}] | ${msg}`);
        msg.delete();
    } else console.log(`NOT REMOVING MESSAGE[ADMIN/MOD & PINNED] | ${msg}`)
}

module.exports = { sendCreatorMessage, removeMessage };
