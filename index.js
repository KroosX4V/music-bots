const Discord = require('discord.js');
const ytdl = require('ytdl-core-discord');
const ytsr = require('ytsr');
const fs = require('fs');
const bots = require('./bots.json');
const { prefix, playlistLength, volumeChangeDuration, mainBot } = require('./config.json');

const mainClient = new Discord.Client();
const mainClientToken = Object.keys(mainBot)[0];
const mainClientChannelID = mainBot[mainClientToken];

mainClient.once('ready', () => {
    mainClient.channels.fetch(mainClientChannelID).then(async mainChannel => {
        let guild = mainClient.guilds.resolve(mainChannel);
        guild.me.setNickname('Head Music Bot');

        for(const token in bots) {
            const channelID = bots[token];
                
            mainClient.channels.fetch(channelID).then(voiceChannel => {
                const client = new Discord.Client();
    
                client.once('ready', () => {
                    initBot(client, channelID);
                });
    
                client.login(token).then(()=>{}, () => {
                    delete bots[token];
                    fs.writeFileSync('bots.json', JSON.stringify(bots));

                    mainChannel.send('Unable to add registered bot [' + token + '] of [' + voiceChannel.parent.name + ' > ' + voiceChannel.name + '].\nThus, it has been removed!\nThis mainly happens due to a no-longer valid token. Check bot\'s token and try adding it again.\n!add [channel-id] [token]');
                });
            }, () => {
                delete bots[token];
                fs.writeFileSync('bots.json', JSON.stringify(bots));
                
                mainChannel.send('Unable to locate channel of bot [' + token + '].\nThus, it has been removed!\nTry to add it again with a correct channel id.\n!add [channel-id] [token]');
            });
        }

        mainClient.on('message', msg => {
            if(msg.channel.id != mainClientChannelID || !msg.content.startsWith(prefix) || msg.author.bot) return;
        
            const args = msg.content.slice(prefix.length).split(/ +/);
            const command = args.shift().toLowerCase();
        
            if(command === 'add') {
                if(isntBotMaker(msg)) return;
                if(args.length < 2) return msg.reply('!add [channel-id] [token]');
                
                const channelID = args[0];
                const token = args[1];
        
                if(isNaN(channelID)) return msg.reply('Invalid channel id!');
                if(token == mainClientToken) return msg.reply('You can\'t add the main bot to a channel!');
                if(bots[token]) return msg.reply('There is already a bot added with this token!');
                
                for(const token in bots) {
                    if(bots[token] == channelID) return msg.reply('There is already a bot added to this channel!');
                }
        
                mainClient.channels.fetch(channelID).then(voiceChannel => {
                    const newClient = new Discord.Client();
        
                    newClient.once('ready', () => {
                        initBot(newClient, channelID);
                        bots[token] = channelID;
                        fs.writeFileSync('bots.json', JSON.stringify(bots));
        
                        msg.reply('Bot has been successfully added to [' + voiceChannel.parent.name + ' > ' + voiceChannel.name + ']!');
                    });
        
                    newClient.login(token).then(()=>{}, () => {
                        msg.reply('Unable to add bot. Check your token!');
                    });
                }, () => {
                    msg.reply('Unable to locate channel. Check your channel\'s id!');
                });
            }
        });

        mainChannel.send('Hello, there!');
    });
});

mainClient.login(mainClientToken);

async function getUsernameByID(guild, id) {
    let member = await guild.members.fetch(id).catch(() => {});

    if(member) {
        return member.nickname? member.nickname : member.user.username;
    }
}

function isntBotMaker(msg) {
    if(msg.member == msg.guild.owner) {
        return false;
    }

    let roles = msg.member.roles.cache.array();
            
    for(let i = 0; i < roles.length; i++) {
        if(roles[i].name === 'Bot Makers .') {
            return false;
        }
    }

    return true;
}

async function youtubeSearch(args, offset) {
    let searchContent = args[offset], ok = true;

    for(let i = offset + 1; i < args.length; i++) {
        searchContent += ' ' + args[i];
    }

    await ytsr(searchContent, {limit: 1}).then(result => {
        args[offset] = result.items[0].link;
    }, () => {
        ok = false;
    });

    return ok;
}

function initBot(client, channelID) {
    client.channels.fetch(channelID).then(voiceChannel => {
        let guild = client.guilds.resolve(voiceChannel);
        let bot = guild.me;
        bot.setNickname('GR || Music Bot');

        voiceChannel.join().then(connection => {
            let dispatcher, playlist = [], currURL, currPlayedByID, currPlayedByName, locked, vol, intervalOn, animVol, x, date;
            let playMusic = async (url, playedByID, playedByName) => {
                currURL = url;
                currPlayedByID = playedByID;
                currPlayedByName = playedByName;

                if(dispatcher) {
                    dispatcher.destroy();
                    dispatcher = undefined;
                }

                let videoName = (await ytdl.getInfo(url)).title;

                if(videoName.length < 2)
                    videoName = 'GR || Music Bot';
                else if(videoName.length > 32)
                    videoName = videoName.substr(0, 32);
                
                bot.setNickname(videoName);
                dispatcher = connection.play(await ytdl(url), { type: 'opus' });
                dispatcher.on('finish', playNextInQueue);

                if(!intervalOn) {
                    if(vol === 0) vol = undefined;
                    if(vol !== undefined) dispatcher.setVolume(vol);
                }
            };
            let playNextInQueue = () => {
                if(playlist.length) {
                    let song = playlist.shift();
                    playMusic(song[0], song[1], song[2]);
                }
                else {
                    dispatcher = undefined;
                    currURL = undefined;
                    currPlayedByID = undefined;
                    currPlayedByName = undefined;
                    bot.setNickname('GR || Music Bot');
                }
            };

            client.on('message', async msg => {
                if(msg.member.voice.channelID !== channelID || !msg.content.startsWith(prefix) || msg.author.bot) return;

                const args = msg.content.slice(prefix.length).split(/ +/);
                const command = args.shift().toLowerCase();

                if(command === 'lock') {
                    if(isntBotMaker(msg)) return msg.reply('You don\'t have permission to lock me!');
                    if(locked) return msg.reply('I\'m already locked!');

                    locked = true;
                    msg.reply('I\'m locked now.');
                }
                else if(command === 'unlock') {
                    if(isntBotMaker(msg)) return msg.reply('You don\'t have permission to unlock me!');
                    if(!locked) return msg.reply('I\'m already unlocked!');

                    locked = undefined;
                    msg.reply('I\'m unlocked now.');
                }
                else if(command === 'play') {
                    if (locked && isntBotMaker(msg)) return msg.reply('Oops! I can\'t accept your commands!');
                    if(playlist.length == playlistLength) return msg.reply('Playlist queue is full!\nYou either have to skip currently playing song to free space in the queue or use !play-at [playlist-position] [YouTube-URL] (BOT MAKERS ONLY) command instead to put your song at a specified playlist position.');
                    if(args.length == 0) return msg.reply('Please enter a valid youtube url!');
                    if(!ytdl.validateURL(args[0]) && !(await youtubeSearch(args, 0))) return msg.reply('Search failed!\nTry to provide a direct youtube link.');

                    if(!dispatcher) {
                        playMusic(args[0], msg.member.id, msg.member.nickname? msg.member.nickname : msg.member.user.username);
                    }
                    else {
                        playlist.push([args[0], msg.member.id, msg.member.nickname? msg.member.nickname : msg.member.user.username]);
                        msg.reply('Song has been added to playlist queue.');
                    }
                }
                else if(command === 'play-at') {
                    if(isntBotMaker(msg)) return msg.reply('You don\'t have permission to use !play-at!');
                    if(isNaN(args[0])) {
                        args.unshift(0);
                        /* let url = args[0];
                        args[0] = 0;
                        args[1] = url; */
                    }
                    else if(args.length < 2) return msg.reply('!play-at [YouTube-URL]\n!play-at [playlist-position] [YouTube-URL]');
                    if(isNaN(args[0])) return msg.reply('Invalid playlist position!');
                    if(args[0] < 0 || args[0] > playlistLength) return msg.reply('Provide a number between 0 and ' + playlistLength);
                    if(!ytdl.validateURL(args[1]) && !(await youtubeSearch(args, 1))) return msg.reply('Search failed!\nTry to provide a direct youtube link.');

                    if(!dispatcher || args[0] == '0') {
                        playMusic(args[1], msg.member.id, msg.member.nickname? msg.member.nickname : msg.member.user.username);
                    }
                    else {
                        if(playlist.length) {
                            if(args[0] > playlist.length) args[0] = playlist.length;
                            playlist[args[0]-1] = [args[1], msg.member.id, msg.member.nickname? msg.member.nickname : msg.member.user.username];
                        }
                        else {
                            args[0] = 1;
                            playlist.push([args[1], msg.member.id, msg.member.nickname? msg.member.nickname : msg.member.user.username]);
                        }

                        msg.reply('Song has been put to playlist at position ' + args[0] + '.');
                    }
                }
                else if(command === 'vol') {
                    if (locked && isntBotMaker(msg)) return msg.reply('Oops! I can\'t accept your commands!');
                    if(args.length == 0 || isNaN(args[0])) return msg.reply('Please provide a number!');
                    if(args[0] < 0 || args[0] > 100) return msg.reply('Please provide a number between 0-100!');

                    animVol = vol !== undefined? vol : 1;
                    vol = args[0] / 100;
                    x = vol - animVol;
                    date = new Date(); 
                    
                    if(!intervalOn) {
                        intervalOn = true;
                        let intervalID = setInterval(() => {
                            let progress = Math.min((new Date()) - date, volumeChangeDuration) / volumeChangeDuration;
                            console.log(progress * x + animVol);
                            if(dispatcher) dispatcher.setVolume(progress * x + animVol);
    
                            if(progress == 1) {
                                clearInterval(intervalID);
                                intervalOn = false;
                            }
                        }, 175);
                    }
                }
                else if(dispatcher) {
                    if(command === 'skip') {
                        if (locked && isntBotMaker(msg)) return msg.reply('Oops! I can\'t accept your commands!');
                        playNextInQueue();
                    }
                    else if(command === 'stop') {
                        if (locked && isntBotMaker(msg)) return msg.reply('Oops! I can\'t accept your commands!');
                        dispatcher.destroy();
                        playlist = [];
                        dispatcher = undefined;
                        currURL = null;
                        bot.setNickname('GR || Music Bot');
                    }
                    else if(command === 'pause') {
                        if (locked && isntBotMaker(msg)) return msg.reply('Oops! I can\'t accept your commands!');
                        if(dispatcher.paused) return msg.reply('Playback is already paused!');

                        dispatcher.pause();
                    }
                    else if(command === 'resume') {
                        if (locked && isntBotMaker(msg)) return msg.reply('Oops! I can\'t accept your commands!');
                        if(!dispatcher.paused) return msg.reply('Playback is already playing!');

                        dispatcher.resume();
                    }
                    else if(command === 'info') {
                        let info = 'Now Playing: ' + (await ytdl.getInfo(currURL)).title + '\nPlaylist Queue:';

                        if(playlist.length) {
                            for(let i = 0; i < playlist.length; i++) {
                                info += '\n\t' + (i+1) + ') ' + (await ytdl.getInfo(playlist[i][0])).title;
                            }
                        }
                        else {
                            info += ' Empty';
                        }

                        msg.reply(info);
                    }
                    else if(command === 'played-by') {
                        let playedBy = await getUsernameByID(guild, currPlayedByID);
                        msg.reply('This song has been played by ' + (playedBy? playedBy : currPlayedByName) + '.' + (!playedBy? '\nThough, it seems he/she has left the server.' : ''));
                    }
                    else if(command === 'replay') {
                        if (locked && isntBotMaker(msg)) return msg.reply('Oops! I can\'t accept your commands!');
                        if(playlist.length == playlistLength) return msg.reply('Playlist queue is full!\nYou either have to skip currently playing song to free space in the queue or use !replay-at [playlist-position] (BOT MAKERS ONLY) command instead to put your song at a specified playlist position.');

                        playlist.push([currURL, msg.member.id, msg.member.nickname? msg.member.nickname : msg.member.user.username]);
                        msg.reply('Song has been added to playlist queue.');
                    }
                    else if(command === 'replay-at') {
                        if(isntBotMaker(msg)) return msg.reply('You don\'t have permission to use !replay-at!');
                        if(args.length == 0) {
                            args[0] = 0;
                        }
                        if(isNaN(args[0])) return msg.reply('Invalid playlist position!');
                        if(args[0] < 0 || args[0] > playlistLength) return msg.reply('Provide a number between 0 and ' + playlistLength);
    
                        if(args[0] == '0') {
                            playMusic(currURL, msg.member.id, msg.member.nickname? msg.member.nickname : msg.member.user.username);
                        }
                        else {
                            if(playlist.length) {
                                if(args[0] > playlist.length) args[0] = playlist.length;
                                playlist[args[0]-1] = [currURL, msg.member.id, msg.member.nickname? msg.member.nickname : msg.member.user.username];
                            }
                            else {
                                args[0] = 1;
                                playlist.push([currURL, msg.member.id, msg.member.nickname? msg.member.nickname : msg.member.user.username]);
                            }
    
                            msg.reply('Song has been put to playlist at position ' + args[0] + '.');
                        }
                    }
                    else if(command === 'link') {
                        msg.reply(currURL);
                    }
                }
            });

            client.on('voiceStateUpdate', (oldState, newState) => {
                if(oldState.id == client.user.id && newState.channelID != channelID) {
                    bot.setNickname('GR || Music Bot');

                    client.channels.fetch(channelID).then(() => {
                        voiceChannel.join().then(newConnection => {
                            connection = newConnection;
                        });
                    }, () => {
                        delete bots[client.token];
                        client.destroy();
                        fs.writeFileSync('bots.json', JSON.stringify(bots));
                    });
                }
            });
        });
    });
}