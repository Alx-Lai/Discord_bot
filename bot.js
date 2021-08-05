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
    //const cmd = msg.content.substring(prefix[cmd_type].Value.length).split(' ')
    //cmd[0] = cmd[0].toLowerCase()
    switch(cmd_type){
        /*case 'getavatar':
            const avatar = GetAvatar(msg)
            if(avatar && avatar.files){
                msg.channel.send(`${msg.author}`,GetAvatar(msg))
            }
            break
        */
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
let Connection
const MusicFunction = (msg) => {
    const cmd = msg.content.substring(prefix['1'].Value.length).split(' ')
    cmd[0] = cmd[0].toLowerCase()
    switch(cmd[0]){
        case 'play':
            addMusic(msg, cmd);
            break
        case 'stop':
            break
        case 'pause':
            break
        case 'replay':
            replayMusic()
            break
        case 'nowplay':
            showNowPlayMusic(msg.channel.id)
            break
        case 'queue':
            showQueue(msg.channel.id)
            break
        case 'skip':
            if(dispatcher) dispatcher.end()
            break
        case 'disconnect':
            disconnectMusic(msg.guild.id, msg.channel.id)
            break
        case 'search':
            searchMusic(cmd)
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
                msg.reply('err when join voice channgel')
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
        const embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle('addMusic Error')
            .setDescription('[Not in Voice channel]')
        msg.channel.send(embed)
        return
    }
    if(url.substring(0,4) !=='http'){
        url = await searchMusic(cmd)
        if(!url)return
        //msg.reply(`find ${url}`)
    }
    const validate = await ytdl.validateURL(url)
    if(!validate){
        msg.reply('not a valid url')
        return
    }
    msg.channel.send(`play ${url}`)
    const info = await ytdl.getInfo(url)
    if(!info.videoDetails){
        msg.reply('not a valid url')
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
            msg.reply('err when join voice channgel')
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
function GetAvatar(msg) {
    try {
        return {
            files: [{
                attachment: msg.author.displayAvatarURL(),
                name: 'avatar.jpg'
            }]
        }
    } catch (err) {
        console.log(err);
    }
}