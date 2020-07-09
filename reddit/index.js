const dotenv = require('dotenv');
const botState = require('../bot/enum/state.js');
const commands = require('./enum/command.js');
const state = require('./enum/state.js');
const Database = require('../bot/database.js');
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

    #subreddit = this.#reddit.getSubreddit("Subscriber_Reddit");
    #discord;
    #channel_name = "reddit-usernames"
    #database_file_name = "reddit_members"
    #database_file_dir = "./reddit/datastore"
    #attempts = []

    invoke = (object, action) => {
        switch(action) {
            case botState.GUILD_MEMBER_REMOVE: 
                this.#handleGuildMemberRemove(object);
                break;
            case botState.GUILD_MEMBER_ADD:
                this.#handleGuildMemberAdd(object);
                break;
            default:
                this.#handleMessage(object);
                break;
        }
    }

    #handleGuildMemberRemove = member => {
        const db = new Database(this.#database_file_name, this.#database_file_dir);
        db.select("member", "author", member.user.id, resp => {
            if(resp.state == db.state.SUCCESS) {
                this.#handleRemoveContributor(resp.row.reddit_name, response => {
                    if(response == state.SUCCESS) console.log(`removed contributor with id ${member.user.id} and username ${member.user.username}: ${resp.row.reddit_name}`)
                });
            }
        });
    }

    #handleGuildMemberAdd = member => {
        const db = new Database(this.#database_file_name, this.#database_file_dir);
        db.select("member", "author", member.user.id, resp => {
            if(resp.state == db.state.SUCCESS && resp.row != null) {
                this.#handleAddContributor(resp.row.reddit_name, response => {
                    if(response == state.SUCCESS) {
                        console.log(`added contributor with id ${member.user.id} and username ${member.user.username}: ${resp.row.reddit_name}`)
                        member.user.send(`***Hi welcome back to the everyday astronaut discord!*** \n\nSince you've been here before and we know you were subsribed to the subreddit, we've automatically given you access with the user ${resp.row.reddit_name}. \n\nIf this is no longer your username don't worry! In the #${this.#channel_name} you can simply type !resubscribe with your new username and it will subscribe you with the new username.\n`)
                    }
                });
            }
        });
    }

    #handleMessage = (msg) => {
        if(!msg.content.startsWith(process.env.PREFIX) || msg.channel.name != this.#channel_name) {
            this.#removeMessage(msg);
            return;
        }
        
        const parameters =  msg.content.split(" ");
        const cmd = parameters[0].replace("!", "");
        const username = parameters[1];

        if(!this.#validateMessage(cmd, username)) {
            this.#removeMessage(msg);
            return;
        } 
        
        if(typeof this.#attempts[username] == "undefined") this.#attempts[username] = 1
        if(cmd == commands.SUBSCRIBE) {
            this.#handleSubscribe(msg, username);
        } else if(cmd == commands.RESUBSCRIBE) {
            this.#handleResubscribe(msg, username);
        } else {
            this.#removeMessage(msg)
        }
    }

    #handleSubscribe = (msg, username) => {
        const db = new Database(this.#database_file_name, this.#database_file_dir);
        db.select("member", "author", msg.author.id, response => {
            if(response.row != null) this.#handleRedditState(msg, state.ALREADY_SUBSCRIBED, username)
            else {
                db.insert("member", ["author", "reddit_name"], [msg.author.id, username], response => {
                    if(response.state == db.state.SUCCESS) {
                        this.#handleAddContributor(username, resp => {
                        
                            if(resp == state.USER_NOT_FOUND) {
                                db.delete("member", "author", msg.author.id, _ => {});
                            }
        
                            this.#handleRedditState(msg, resp, username);
                        });
                    } else if(response.state == db.state.CONSTRAINT_ERROR) {
                        this.#handleRedditState(msg, state.ALREADY_SUBSCRIBED, username)
                    } else {
                        this.#handleRedditState(msg, state.FAILURE, username)
                    }
                });
            }
        })
    }

    #handleResubscribe = (msg, username) => {
        const db = new Database(this.#database_file_name, this.#database_file_dir);
        db.select("member", "author", msg.author.id, response => {
            if(response.state == db.state.SUCCESS) {
                if(response.row == null) this.#handleRedditState(msg, state.NOT_YET_SUBSCRIBED, username)
                else {
                    this.#handleRemoveContributor(username, _ => {});
                    db.delete("member", "author", msg.author.id, _ => {});
                    db.insert("member", ["author", "reddit_name"], [msg.author.id, username], _ => {
                        if(response.state == db.state.SUCCESS) {
                            this.#handleAddContributor(username, resp => {
                                if(resp == state.USER_NOT_FOUND) {
                                    db.delete("member", "author", msg.author.id, _ => {});
                                    db.insert("member", ["author", "reddit_name"], [msg.author.id, response.row.reddit_name], _ => {});
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
            this.#sendCreatorMessage(
                `ERROR REMOVING PERMISSIONS`
                `the bot was unable to remove the reddit permissions of user ${author.id}`
                );
            callback(state.FAILURE)
        });
    }

    #removeMessage = msg => {
        msg.delete();
    }

    #validateMessage  = (cmd, username) => {
        if(username == "" || username == "undefined") return false;
        else if(cmd == "undefined") return false;
        else return true;
    }

    #handleRedditState = (msg, receivedState, username) => {
        switch(receivedState) {
            case state.USER_NOT_FOUND: 
                msg.reply("The username you provided was not found please try again :smile:");
                this.#attempts[username] = 0;
                break;
            case state.ALREADY_SUBSCRIBED: 
                msg.reply(`You are already subscribed to the subreddit according to our systems, If you want to change the user which has access to the subreddit then use the command !resubscribe ${username}`);
                this.#attempts[username] = 0;
                break;
            case state.FAILURE:
                if(this.#attempts[username] == 3) {
                    msg.reply(":robot: Hmm something went wrong, I might be broken I have contacted my creator.");
                    this.#sendCreatorMessage(
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
                msg.reply(`You are not yet subscribed please use the !subscribe ${username} commmand to subscribe :wink:`);
                this.#attempts[username] = 0;
                break;
            default:
                msg.reply(`Great! You're all set, you now have access to the subreddit with the account ${username}`);
                this.#attempts[username] = 0;
                break;
        }
    }

    #sendCreatorMessage = (title, msg) => {
        const content = `\n\n***${title}*** \n${msg}`
        this.#discord.guilds.cache.entries().next().value[1].members.cache.get("199157185320583168").send(content);
    }
}

module.exports = Reddit;