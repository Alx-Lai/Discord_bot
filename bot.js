//#region import 
const Discord = require('discord.js')
const client = new Discord.Client()
const prefix = require('./prefix.json')
const ytdl = require('ytdl-core')
const puppeteer = require('puppeteer')
const cheerio = require('cheerio')
require('dotenv-defaults').config()
//#endregion
//#region login
client.login(process.env.BOT_KEY)

client.on('ready', ()=>{
    console.log(`Log in as ${client.user.tag}!`)
})
//#endregion
//#region interact
client.on('message', (msg) => {
    if(!msg.author) return
    if(msg.author.bot) return
    if(!msg.guild) return

    let cmd_type = '-1'
    const prefixED = Object.keys(prefix)
    prefixED.forEach((element) => {
        if(msg.content.substring(0,prefix[element].Value.length) == prefix[element].Value){
            cmd_type = element
        }
    })
    if(cmd_type == '-1')return
    switch(cmd_type){
        case '1':
            MusicFunction(msg)
        default:
            break
    }   
})
//#endregion 
//#region musicFunction
let MusicQueue = []
let dispatcher
let MusicStatus = 'NoMusic'
let Connection
const MusicFunction = async (msg) => {
    const cmd = msg.content.substring(prefix['1'].Value.length).split(' ')
    cmd[0] = cmd[0].toLowerCase()
    switch(cmd[0]){
        case 'play':
            await addMusic(msg, cmd);
            break
        case 'pause':
            if(!dispatcher){
                raiseErrorEmbed(msg.channel.id, 'Dispatcher Not Defined')
                break
            }
            if(MusicStatus == 'Playing'){
                await dispatcher.pause()
                MusicStatus = 'Pause'
            }else{
                raiseErrorEmbed(msg.channel.id, 'Invalid:Cannot pause now')
            }
            break
        case 'resume':
            if(!dispatcher){
                raiseErrorEmbed(msg.channel.id, 'Dispatcher Not Defined')
                break
            }
            if(MusicStatus == 'Pause'){
                await dispatcher.resume()
                MusicStatus = 'Playing'
            }else{
                raiseErrorEmbed(msg.channel.id, 'Invalid:Cannot resume now')
            }
            break
        case 'replay':
            await replayMusic()
            break
        case 'nowplay':
            await showNowPlayMusic(msg.channel.id)
            break
        case 'lower':
            if(!dispatcher){
                raiseErrorEmbed(msg.channel.id, 'Dispatcher Not Defined')
                break
            }
            dispatcher.setVolume(dispatcher.volume-0.1)
            break
        case 'higher':
            if(!dispatcher){
                raiseErrorEmbed(msg.channel.id, 'Dispatcher Not Defined')
                break
            }
            dispatcher.setVolume(dispatcher.volume+0.1)
            break
        case 'queue':
            await showQueue(msg.channel.id)
            break
        case 'skip':
            if(dispatcher)await dispatcher.end()
            break
        case 'disconnect':
            await disconnectMusic(msg.guild.id, msg.channel.id)
            break
        case 'search':
            await searchMusic(cmd)
            break
        case 'playfix':
            msg.member.voice.channel.join()
            .then(connection => {
                msg.reply('Here I am~')
                const guildID = msg.guild.id
                const channelID = msg.channel.id
                playMusic(connection, guildID, channelID)
            })
            .catch(err => {
                raiseErrorEmbed(msg.channel.id, 'Join Voice Channel failed')
            })
        default:
            msg.reply('Not a valid music command!')
            break
    }
}
const addMusic = async (msg, cmd) =>{
    let url = cmd[1];
    if(!url)return
    if(!msg.member.voice.channel){
        raiseErrorEmbed(msg.channel.id, 'Not in Voice channel')
        return
    }
    if(url.substring(0,4) !=='http'){
        url = await searchMusic(cmd)
        if(!url)return
        //msg.reply(`find ${url}`)
    }
    const validate = await ytdl.validateURL(url)
    if(!validate){
        raiseErrorEmbed(msg.channel.id, 'Not/Cannot Find valid url')
        return
    }
    msg.channel.send(`play ${url}`)
    const info = await ytdl.getInfo(url)
    if(!info.videoDetails){
        raiseErrorEmbed(msg.channel.id, 'Not/Cannot Find valid url')
        return
    }
    MusicQueue.push(url)
    //join voice channel
    msg.member.voice.channel.join()
        .then(connection => {
            msg.reply('Here I am~')
            const guildID = msg.guild.id
            const channelID = msg.channel.id
            playMusic(connection, guildID, channelID)
        })
        .catch(err => {
            raiseErrorEmbed(msg.channel.id, 'Join Voice Channel failed')
        })
    
}
const searchMusic = async (args)=>{
    if(args.length < 2)return
    let querystring = args[1]
    for(var i=2;i<args.length;i++){
        querystring += '+' + args[i]
    }
    const browser = await puppeteer.launch({
        args:['--no-sandbox']
    })
    const page = await browser.newPage()
    let url = 'https://www.youtube.com/results?search_query='+querystring
    await page.goto(url)
    const html = await page.content()
    const results = parse(html)
    await browser.close()
    return results[0]
}
function parse(html){
    const $ = cheerio.load(html)
    let results = []
    $('#contents ytd-video-renderer').each((i,link) =>{
        results.push('https://www.youtube.com' + $(link).find('#thumbnail').attr('href'))
    })
    return results
}
const playMusic = async (connection, guildID, channelID)=>{
    if(MusicQueue.length == 0)return
    const streamOptions = {
        seek: 0,
        volume: 0.5,
        Bitrate: 192000,
        Passes: 1,
        highWaterMark: 1
    }
    const stream = await ytdl(MusicQueue[0],{
        filter:'audioonly',
        quality:'highestaudio',
        highWaterMark:26214400
    })
    dispatcher = connection.play(stream, streamOptions)
    MusicStatus = 'Playing'
    dispatcher.on('finish', (finish)=>{
        if(MusicQueue.length > 0){
            MusicQueue.shift()
            playMusic(connection,guildID, channelID)
        }else{
            disconnectMusic(guildID, channelID)
        }
    })
}
const disconnectMusic = (guildID, channelID) => {
    if(client.voice.connections.get(guildID)){
        MusicQueue = []
        client.voice.connections.get(guildID).disconnect()
        MusicStatus = 'NoMusic'
        dispatcher = undefined
        client.channels.fetch(channelID).then(channel=>channel.send('disconnect'))
    }
}
const replayMusic = ()=>{
    if(MusicQueue.length > 0){
        MusicQueue.unshift(MusicQueue[0])
        if(dispatcher)dispatcher.end()
    }
}
const showQueue = async (channelID)=>{
    if(MusicQueue.length > 0){
        let info
        let message = ''
        for(var i=0;i<MusicQueue.length;i++){
            info = await ytdl.getInfo(MusicQueue[i])
            title = info.videoDetails.title
            message += `\n${i+1}. ${title}`
        }
        message = message.substring(1)
        client.channels.fetch(channelID).then(channel=> channel.send(message))
    }
}
const showNowPlayMusic= async (channelID)=>{
    if(!dispatcher)return
    if(MusicQueue.length > 0){
        const info = await ytdl.getInfo(MusicQueue[0])
        const title = info.videoDetails.title
        let songLength = [Math.floor(info.videoDetails.lengthSeconds/60)+'', info.videoDetails.lengthSeconds%60+'']
        let nowSongLength = [Math.floor(dispatcher.streamTime / 60000)+'', Math.floor(dispatcher.streamTime / 1000)%60+'']
        if(songLength[0].length < 2)songLength[0] = '0' + songLength[0]
        if(songLength[1].length < 2)songLength[1] = '0' + songLength[1]
        if(nowSongLength[0].length < 2)nowSongLength[0] = '0' + nowSongLength[0]
        if(nowSongLength[1].length < 2)nowSongLength[1] = '0' + nowSongLength[1]
        const message = `${title}\n${nowSongLength[0]}:${nowSongLength[1]}/${songLength[0]}:${songLength[1]}`
        client.channels.fetch(channelID).then(channel=> channel.send(message))
    }else{
        client.channels.fetch(channelID).then(channel=> channel.send('Nothing is playing'))
    }
}
//#endregion
const raiseErrorEmbed = (channelID, description)=>{
    let embed = new Discord.MessageEmbed()
        .setColor('ff0000')
        .setAuthor(client.user.username, client.user.displayAvatarURL(), 'https://github.com/Alx-Lai/Discord_bot')
        .setTitle('Error')
        .setDescription(description)
    client.channels.fetch(channelID).then(channel => channel.send(embed))
}