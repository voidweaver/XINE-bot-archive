const Discord = require("discord.js");
const format = require("string-format");
const fs = require("fs");

format.extend(String.prototype, {});

const {exec} = require("child_process");

const Helper = require("./helper");
const {SettingsLoader, PreferencesLoader, ResourceLoader} = require("./loader");
var tasks = {};

var ip_updater;

var public_ip;
const settings_loader = new SettingsLoader("./settings.json");
var SETTINGS = settings_loader.get();
const str_loader = new ResourceLoader("./resources/strings.json");
var STR = str_loader.get()["en"];

const client = new Discord.Client();

client.once("ready", () => {
    checkForIP();
    console.log(STR.log.active);
});

const updateIP = () => {
    exec(
        "dig +tries=1 +short -4 A myip.opendns.com @resolver1.opendns.com",
        (err, stdout, stderr) => {
            if (err) {
                console.error(STR.log.ip_error.format(err));
            } else {
                public_ip =
                    stdout.charAt(stdout.length - 1) == "\n"
                        ? stdout.slice(0, -1)
                        : stdout;
            }
        }
    );
};

function checkForIP(ms) {
    clearInterval(ip_updater);
    updateIP();
    ip_updater = setInterval(
        updateIP,
        isNaN(ms) ? SETTINGS.defaults.ip_interval : ms
    );
}

function parseArgs(raw, prefix) {
    let tokens = raw.split(" ").filter(el => {
        return el != "";
    });
    if (tokens.length == 0) return [null];

    let command = tokens.shift();
    if (command == prefix && tokens.length > 0) {
        command += tokens.shift();
    }

    let mentioned = false;

    let mention_test = new RegExp("<@!?" + client.user.id + ">");

    while (command && command.match(mention_test)) {
        mentioned = true;
        command = tokens.shift();
    }

    if (!command) command = "";

    let command_name = null;

    if (command.startsWith(prefix) || mentioned) {
        if (command.startsWith(prefix)) {
            command_name = command.slice(prefix.length);
        } else {
            command_name = command;
        }

        command_name = command_name.toLowerCase();

        if (command_name in SETTINGS.aliases) {
            command_name = SETTINGS.aliases[command_name];
        }
    }

    return [command_name].concat(tokens);
}

function sendEmbed(channel, fields) {
    let escape = fields.escape;
    if (escape) fields.content = Helper.dEscape(fields.content);

    let color = fields.color;
    color = color ? color : "default";
    let embed = new Discord.MessageEmbed()
        .setColor(SETTINGS.colors[color])
        .setTitle(fields.title ? fields.title : STR.default.embed_title)
        .setDescription(
            fields.content ? fields.content : STR.default.embed_description
        );

    if (fields.fields && typeof fields.fields[Symbol.iterator] === "function") {
        embed.addFields(...fields.fields);
    }

    channel.send(embed);
}

function countLeading(str, lead = " ") {
    for (let i = 0; i < str.length; i++) {
        if (str[i] != lead) return i;
    }
    return str.length - 1;
}

function sendMsg(channel, msg, escape = true) {
    if (escape) msg = Helper.dEscape(msg);
    return channel.send(msg);
}

client.on("message", msg => {
    if (msg.author == client.user) return;

    let id = msg.channel.id;
    let is_dm = msg.guild === null ? 1 : 0;
    let guild_name = is_dm ? null : msg.channel.guild.name;
    let channel_name = is_dm ? msg.author.tag : msg.channel.name;

    var preferences_loader = new PreferencesLoader("./guild_preferences", id);

    var PREFS = preferences_loader.get();

    if (PREFS === undefined) {
        preferences_loader.make({
            info: {
                is_dm: is_dm,
                guild_name: guild_name,
                channel_name: channel_name
            },
            user_preferences: {
                prefix: is_dm
                    ? SETTINGS.defaults.dm_prefix
                    : SETTINGS.defaults.prefix
            }
        });
    } else {
        PREFS.info.guild_name = guild_name;
        PREFS.info.channel_name = channel_name;
        preferences_loader.save();
    }

    PREFS = preferences_loader.get();

    let args = parseArgs(msg.content, PREFS.user_preferences.prefix);

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    async function on_kill(channel) {
        for (text of STR.display.hack.killed) {
            await sendMsg(channel, text);
            await sleep(600);
        }
    }

    if (msg.channel.id in tasks) {
        let task = tasks[msg.channel.id];
        switch (task._task_name) {
            case "hacked":
                if (msg.author.id == task.hacker.id) {
                    switch (args[0]) {
                        case "kill":
                        case "terminate":
                        case "stop":
                        case "exit":
                        case "logout":
                            delete tasks[msg.channel.id];
                            on_kill(msg.channel);
                            return;
                        default:
                            sendMsg(msg.channel, msg.content, false);
                            if (
                                msg.guild &&
                                msg.guild.me.hasPermission(
                                    Discord.Permissions.FLAGS.MANAGE_MESSAGES
                                )
                            ) {
                                msg.delete();
                            }
                            return;
                    }
                }
                break;
        }
    }

    if (!args[0]) return;

    switch (args[0]) {
        case "ip":
            sendEmbed(msg.channel, {
                content: STR.display.ip.format(Helper.dCode(public_ip))
            });
            break;
        case "ping":
            sendMsg(msg.channel, STR.display.greet);
            break;
        case "reload":
            settings_loader.reload().then(() => {
                SETTINGS = settings_loader.get();
            });

            sendEmbed(msg.channel, {
                content: STR.display.debug.reload
            });
            break;
        case "parse":
            sendMsg(msg.channel, `[${args.join(", ")}]`);
            break;
        case "id":
            sendEmbed(msg.channel, {
                title: STR.display.debug.title,
                content: STR.display.debug.id.format(Helper.dCode(id))
            });
            break;
        case "preferences":
            {
                let all = false;
                for (let arg of args.slice(1)) {
                    if (arg == "-a" || arg == "--all") {
                        all = true;
                        break;
                    }
                }

                let json_str;

                if (all) {
                    json_str = Helper.sortedStringify(
                        PREFS,
                        undefined,
                        SETTINGS.indent_size
                    );
                } else {
                    json_str = Helper.sortedStringify(
                        PREFS.user_preferences,
                        undefined,
                        SETTINGS.indent_size
                    );
                    let tab = " ".repeat(SETTINGS.indent_size);
                    json_str = json_str.replace(/\n/g, `\n${tab}`);
                    json_str = `{\n${tab}"user_preferences": ${json_str}\n}`;
                }

                sendEmbed(msg.channel, {
                    title: STR.display.debug.pref_title,
                    content: Helper.dBlock(json_str, "json")
                });
            }
            break;
        case "noprefix":
        case "prefix":
            {
                let prefix = args[0] == "noprefix" ? "" : args[1];
                if (prefix || prefix == "") {
                    if (prefix == "" && !PREFS.info.is_dm) {
                        sendEmbed(msg.channel, {
                            title: STR.display.prefix.notdm_title,
                            content: STR.display.prefix.notdm_desc,
                            color: "error"
                        });
                        break;
                    }

                    if (PREFS.user_preferences.prefix == prefix) {
                        sendEmbed(msg.channel, {
                            title: STR.display.prefix.default_title,
                            content: STR.display.prefix.unchanged.format(
                                Helper.dPrefix(PREFS.user_preferences.prefix)
                            )
                        });
                        break;
                    }

                    PREFS.user_preferences.prefix = prefix;
                    preferences_loader.save();

                    let info = STR.display.prefix.changed.format(
                        Helper.dPrefix(PREFS.user_preferences.prefix)
                    );
                    if (PREFS.user_preferences.prefix.length > 1) {
                        info += `\n${STR.display.prefix.long_prefix_warning}`;
                    }
                    sendEmbed(msg.channel, {
                        title: STR.display.prefix.default_title,
                        content: info
                    });
                } else {
                    sendEmbed(msg.channel, {
                        title: STR.display.prefix.default_title,
                        content: STR.display.prefix.show.format(
                            Helper.dPrefix(PREFS.user_preferences.prefix)
                        )
                    });
                }
            }
            break;
        case "help":
            {
                let fields = [];
                let prefix = PREFS.user_preferences.prefix;
                let help_texts = STR.display.help.entries;
                for (let category in help_texts) {
                    let content = "";
                    for (let command in help_texts[category]) {
                        content += `${Helper.dCode(prefix + command)}: ${
                            help_texts[category][command]
                        }\n`;
                    }
                    fields.push({
                        name: category,
                        value: content
                    });
                }
                sendEmbed(msg.channel, {
                    title: STR.display.help.title,
                    content: STR.display.help.header.format(
                        Helper.dPrefix(PREFS.user_preferences.prefix)
                    ),
                    fields: fields
                });
            }
            break;
        case "alias":
            if (args[1]) {
                if (args[1] in SETTINGS.aliases) {
                    let prefix = PREFS.user_preferences.prefix;
                    let alias_name = Helper.dCode(prefix + args[1]);
                    let target = Helper.dCode(
                        prefix + SETTINGS.aliases[args[1]]
                    );
                    sendEmbed(msg.channel, {
                        title: STR.display.alias.get_title,
                        content: STR.display.alias.get.format(
                            alias_name,
                            target
                        )
                    });
                } else {
                    sendEmbed(msg.channel, {
                        title: STR.display.alias.get_failed_title,
                        content: STR.display.alias.get_failed.format(args[1]),
                        color: "error"
                    });
                }
            } else {
                let content = "";
                let prefix = PREFS.user_preferences.prefix;
                for (alias in SETTINGS.aliases) {
                    let alias_name = Helper.dCode(prefix + alias);
                    let target = Helper.dCode(prefix + SETTINGS.aliases[alias]);
                    content += `${STR.display.alias.get.format(
                        alias_name,
                        target
                    )}\n`;
                }
                sendEmbed(msg.channel, {
                    title: STR.display.alias.list_title,
                    content: content
                });
            }
            break;
        case "say":
            {
                let trimmed = msg.content.trim();
                let prefix_end = PREFS.user_preferences.prefix.length;
                let prefix_separator_count = countLeading(
                    trimmed.substring(prefix_end)
                );
                let cmd_start = prefix_end + prefix_separator_count;
                let cmd_end = cmd_start + args[0].length;
                let msg_start =
                    cmd_end + countLeading(msg.content.substring(cmd_end));

                sendMsg(msg.channel, msg.content.substring(msg_start), false);
                if (!PREFS.info.is_dm && msg.guild) {
                    if (
                        msg.guild.me.hasPermission(
                            Discord.Permissions.FLAGS.MANAGE_MESSAGES
                        )
                    ) {
                        msg.delete();
                    }
                }
            }
            break;
        case "hack":
            if (PREFS.info.is_dm) {
                sendEmbed(msg.channel, {
                    title: STR.display.hack.failed.dm_title,
                    content: STR.display.hack.failed.dm,
                    color: "error"
                });
            } else {
                if (msg.guild) {
                    if (
                        msg.guild.me.hasPermission(
                            Discord.Permissions.FLAGS.MANAGE_MESSAGES
                        )
                    ) {
                        tasks[msg.channel.id] = {
                            _task_name: "hacked",
                            hacker: msg.author
                        };
                        msg.delete();
                        let hacked_msg = msg.author.bot
                            ? STR.display.hack.start_warn
                            : STR.display.hack.start;
                        sendMsg(
                            msg.channel,
                            hacked_msg.format(msg.author),
                            false
                        ).then(msg_sent => {
                            setTimeout(_ => {
                                msg_sent.delete();
                            }, 10000);
                        });
                    } else {
                        sendEmbed(msg.channel, {
                            title: STR.display.hack.failed.guild_title,
                            content: STR.display.hack.failed.guild,
                            color: "error"
                        });
                    }
                }
            }
            break;
        case "whoareyou":
            {
                let personality = client.user.toString();
                if (msg.channel.id in tasks) {
                    let task = tasks[msg.channel.id];
                    if (task._task_name == "hacked") {
                        personality = STR.display.whoru.glitch_personality.format(
                            task.hacker
                        );
                    }
                }
                sendMsg(
                    msg.channel,
                    STR.display.whoru.response.format(personality),
                    false
                );
            }
            break;
        default:
            sendEmbed(msg.channel, {
                title: STR.display.not_found.title,
                content: STR.display.not_found.desc.format(
                    Helper.dCode(args[0]),
                    Helper.dCode(PREFS.user_preferences.prefix + "help")
                ),
                color: "error"
            });
            break;
    }
});

client.on("channelDelete", channel => {
    new PreferencesLoader("./guild_preferences", channel.id).wipe();
});

fs.readFile("./token", "utf-8", (err, data) => {
    let token;
    if (data) {
        data = data.replace(/\r/g, "");
        let newline_location = data.search("\n");
        token = data.slice(
            0,
            newline_location != -1 ? newline_location : undefined
        );
    }

    let token_check = /^[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}$/;

    if (err || !token.match(token_check)) {
        console.log(
            "Token does not match regular expression /^[MN][A-Za-z\\d]{23}\\.[\\w-]{6}\\.[\\w-]{27}$/, prompting for token"
        );

        let prompt = require("prompt");

        let properties = [
            {
                name: "token",
                hidden: true,
                validator: token_check,
                warning:
                    "Token must match regular expression /[MN][A-Za-z\\d]{23}\\.[\\w-]{6}\\.[\\w-]{27}/"
            }
        ];

        prompt.start();

        prompt.get(properties, function(err, result) {
            if (err) {
                throw err;
            }
            client.login(result.token);
        });
    } else {
        client.login(token);
    }
});
