const dotenv = require('dotenv');
const botState = require('../bot/enum/state.js');
const type = require('../bot/enum/type.js');
const commands = require('./enum/command.js');
const state = require('./enum/state.js');
const {sendCreatorMessage, removeMessage} = require('../common/message.js');
const Database = require('../common/database.js');
const snoowrap = require('snoowrap');
env = dotenv.config();

class Reddit {
    constructor(discord) {
        this.#discord = discord;
    }

    #reddit = new snoowrap({
        clientId: process.env.REDDIT_CLIENTID,
        clientSecret: process.env.REDDIT_SECRET,
        username: process.env.REDDIT_USERNAME,
        password: process.env.REDDIT_PASSWORD,
        userAgent: "SaturnServer"
    });

    #subreddit = this.#reddit.getSubreddit(process.env.REDDIT_SUBREDDIT);
    #discord;
    #channel_name = process.env.DISCORD_CHANNEL_NAME
    #delete_delay = process.env.REDDIT_DELETE_TIMEOUT * 1000
    #database_file_name = "reddit_members"
    #database_file_dir = "./reddit/datastore"
    #attempts = []

    #db = new Database(this.#database_file_name, this.#database_file_dir);

    invoke = (object, action, user) => {
        switch(action) {
            case botState.MESSAGE: 
                if(user == type.BOT) this.#handleBotMessage(object);
                else this.#handleMessage(object);
                break;
            case botState.STARTUP:
                this.#cleanChannel(object);
                return;
            default:
                return;
        }
    }

    #cleanChannel = (bot) => {
        bot.channels.cache.filter(x => x.name == this.#channel_name).map(x => {
            x.messages.fetch({limit:10}).then(messages => {
                messages.forEach(message => {
                    if(message.channel.name == this.#channel_name) {
                        this.#db.select("member", "author", message.author.id, response => {
                            if(response.row == null || message.content.startsWith(process.env.PREFIX) && message.content.includes("resubscribe")) { 
                                this.#handleMessage(message)
                                setTimeout(_ => {
                                    removeMessage(message, `REDDIT | STARTUP CLEANUP | ${message.channel.name.toUpperCase()}`)
                                }, this.#delete_delay);
                            } else {
                                removeMessage(message, `REDDIT | STARTUP CLEANUP | ${message.channel.name.toUpperCase()}`)
                            }
                        });
                    }
                });
            });
        });
        return;
    }

    #handleBotMessage = (msg) => {
        setTimeout(_ => {
            if(msg.channel.name == this.#channel_name) removeMessage(msg, `REDDIT | CLEANUP | ${msg.channel.name.toUpperCase()}`)
        },  this.#delete_delay);
    }

    #handleMessage = (msg) => {
        if(!msg.content.startsWith(process.env.PREFIX) || msg.channel.name != this.#channel_name) {
            if(!msg.content.startsWith(process.env.PREFIX) && msg.channel.name == this.#channel_name && !msg.author.bot && !(msg.member.roles.cache.find(role => role.name === 'Admin' || role.name === 'Mod'))) removeMessage(msg, `REDDIT | COMMAND | ${msg.channel.name.toUpperCase()}`);
            return;
        } else {
            const parameters =  msg.content.split(" ");
            const cmd = parameters[0].replace("!", "");
            const username = parameters[1].replace("u/", "");
    
            if(!this.#validateMessage(cmd, username)) {
                removeMessage(msg, `REDDIT | USERNAME | ${msg.channel.name.toUpperCase()}`);
                return;
            } 
            
            if(typeof this.#attempts[username] == "undefined") this.#attempts[username] = 1
            if(cmd == commands.SUBSCRIBE) {
                this.#handleSubscribe(msg, username);
            } else if(cmd == commands.RESUBSCRIBE) {
                this.#handleResubscribe(msg, username);
            } else {
                removeMessage(msg, `REDDIT | COMMAND | ${msg.channel.name.toUpperCase()}`)
            }
        }
    }

    #handleSubscribe = (msg, username) => { 
        const date = new Date().toUTCString();       
        this.#db.select("member", "author", msg.author.id, response => {
            if(response.row != null) this.#handleRedditState(msg, state.ALREADY_SUBSCRIBED, username)
            else {
                this.#db.insert("member", ["dateUTC", "author", "reddit_name"], [date, msg.author.id, username], response => {
                    if(response.state == this.#db.state.SUCCESS) {
                        this.#handleAddContributor(username, resp => {
                        
                            if(resp == state.USER_NOT_FOUND) {
                                this.#db.delete("member", "author", msg.author.id, _ => {});
                            }
        
                            this.#handleRedditState(msg, resp, username);
                        });
                    } else if(response.state == this.#db.state.CONSTRAINT_ERROR) {
                        this.#handleRedditState(msg, state.ALREADY_SUBSCRIBED, username)
                    } else {
                        this.#handleRedditState(msg, state.FAILURE, username)
                    }
                });
            }
        })
    }

    #handleResubscribe = (msg, username) => {
        const date = new Date().toUTCString();
        this.#db.select("member", "author", msg.author.id, response => {
            if(response.state == this.#db.state.SUCCESS) {
                if(response.row == null) this.#handleRedditState(msg, state.NOT_YET_SUBSCRIBED, username)
                else {
                    this.#handleRemoveContributor(username, _ => {});
                    this.#db.delete("member", "author", msg.author.id, _ => {});
                    this.#db.insert("member", ["dateUTC", "author", "reddit_name"], [date, msg.author.id, username], _ => {
                        if(response.state == this.#db.state.SUCCESS) {
                            this.#handleAddContributor(username, resp => {
                                if(resp == state.USER_NOT_FOUND) {
                                    this.#db.delete("member", "author", msg.author.id, _ => {});
                                    this.#db.insert("member", ["dateUTC", "author", "reddit_name"], [date, msg.author.id, response.row.reddit_name], _ => {});
                                    this.#handleAddContributor(response.row.reddit_name, _ => {});
                                }
            
                                this.#handleRedditState(msg, resp, username);
                            });
                        } else {
                            this.#handleRedditState(msg, state.FAILURE, username)
                        }
                    });
                }
            } else {
                this.#handleRedditState(msg, state.FAILURE, username)
            }
        });
    }

    #handleAddContributor = (username, callback) => {
        this.#subreddit.addContributor({name: username}).then(_ => {
            callback(state.SUCCESS)
        }).catch(err => {
            if(err.toString().includes("USER_DOESNT_EXIST")) callback(state.USER_NOT_FOUND)
            else callback(state.FAILURE)
        });
    }

    #handleRemoveContributor = (username, callback) => {
        this.#subreddit.removeContributor({name: username}).then(_ => {
            callback(state.SUCCESS)
        }).catch(err => {
            console.log(err);
            sendCreatorMessage(
                this.#discord,
                `ERROR REMOVING PERMISSIONS`,
                `the bot was unable to remove the reddit permissions of user ${username}`
            )
            callback(state.FAILURE)
        });
    }

    #validateMessage  = (cmd, username) => {
        if(username == "" || username == "undefined" || username == undefined) return false;
        else if(cmd == "undefined") return false;
        else return true;
    }

    #handleRedditState = (msg, receivedState, username) => {
        switch(receivedState) {
            case state.USER_NOT_FOUND: 
                msg.reply("The username you provided was not found, please try again :smile:");
                this.#attempts[username] = 0;
                break;
            case state.ALREADY_SUBSCRIBED: 
                msg.reply(`You are already subscribed to the subreddit according to our systems. If you want to change the user which has access to the subreddit then use the command !resubscribe ${username}`);
                this.#attempts[username] = 0;
                break;
            case state.FAILURE:
                if(this.#attempts[username] == 3) {
                    msg.reply(":robot: Hmm something went wrong, I might be broken so I have contacted my creator.");
                    sendCreatorMessage(
                        this.#discord,
                        `ADD TO SUBREDDIT ERROR`,
                        `The bot has tried to subscribe someone for 3 times now. \nNo luck so far the user which tried to get access to the subreddit was ${msg.author.username}#${msg.author.discriminator} and his reddit account is ${username}`
                    )
                    this.#attempts[username] = 0;
                } else {
                    msg.reply(":robot: Hmm something went wrong, perhaps the wrong username? Please try again.");
                    this.#attempts[username] ++;
                }
                break;
            case state.NOT_YET_SUBSCRIBED:
                msg.reply(`You are not yet subscribed. Please use the !subscribe ${username} command to subscribe :wink:`);
                this.#attempts[username] = 0;
                break;
            default:
                msg.reply(`Great! You’re all set, you now have access to the subreddit with the account ${username}`);
                this.#attempts[username] = 0;
                break;
        }
        
        setTimeout(_ => {
            if(!msg.pinned) removeMessage(msg, `REDDIT | CLEANUP | ${msg.channel.name.toUpperCase()}`)
        }, this.#delete_delay)
    }
}

module.exports = Reddit;
