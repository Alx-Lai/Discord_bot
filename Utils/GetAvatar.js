const GetAvatar = (msg) => {
    try{
        return{
            files: [{
                attachment: msg.author.displayAvatarURL(),
                name: 'avatar.jpg'
            }]
        }
    }catch(e){
    }
}
export default GetAvatar