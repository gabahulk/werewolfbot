const Discord = require('discord.js');

var usersPlayingGames = {};
var games = {};
// var defaultGameRoles = ["Lobisomem", "Lobisomem", "Médico", "Vidente", "Aldeão", "Aldeão", "Aldeão"];
// var defaultGameRoles = ["Lobisomem"];
// var defaultGameRoles = ["Lobisomem", "Médico"];
var defaultGameRoles = ["Aldeão", "Médico"];
// Create an instance of a Discord client
const client = new Discord.Client();

var auth = require('./auth.json');

client.login(auth.token);



function onReady(){
  console.log('I am ready!');
}

client.on('ready', onReady);

function get_werewolf_category_id(channels){
    for (const [id, channel] of channels.entries()) {
      if (channel.name == "Werewolf Games" && channel.type == "category") {
          return id
      } 
    }

    return null
}


function createGame(message, gameName){
    if (!gameName) {
        gameName = message.id
    }

    var category_id = get_werewolf_category_id(message.guild.channels)

    if (!category_id) {
        return message.guild.createChannel("Werewolf Games", {type: "category"}).then(category =>{
           return message.guild.createChannel(gameName, {parent :category}) 
        })
    }
    
    return message.guild.createChannel(gameName, {parent : category_id})
}

function handleGameCreation(message) {
    for (var key in games) {
        if (games.hasOwnProperty(key)) { 
            var players = games[key]  
            if (message.author.id in players) {
                message.reply('Hey! Você já está jogando uma partida!'); 
                return false
            }
        }
    }
    
    createGame(message, gameName).then( game => {
        games[game.id] = {gameChannel: game}

        game.createInvite()
          .then(invite => {
            message.channel.send(`Vamos jogar Lobisomem? Todos que queiram jogar entrem nesse link e mandem um ` + `!ready` + ` ! ${invite.url}`);
          })
          .catch(console.error);
    });
}

function handleGameConfiguration(message) {
    
}


function handleGameReady(message){
    if (!(message.channel.id in games)) {
        //TODO: improve this message
        message.reply('Esse não é um canal de jogo! Para criar um novo jogo digite `!creategame`'); 
        return false
    }

    var game = games[message.channel.id]
    var players
    if (!game.players) {
        game.players = {}  
    }
    message.channel.send(`${message.author.username} está pronto!`); 
    game.players[message.author.id] = {user:message.author}
}

function getWerewolfPlayers(players) {
    var werewolfPlayers = []
    for (var key in players) {
        if (players.hasOwnProperty(key)) { 
            var player = players[key]  
            if (player.role == "Lobisomem") {
                werewolfPlayers.push(player.user)
            }
        }
    }

    return werewolfPlayers
}

function broadcastWerewolves(players) {
    var werewolfPlayers = []
    var werewolfMessage = "Os Lobisomens são: \n"
    for (var key in players) {
        if (players.hasOwnProperty(key)) { 
            var player = players[key]  
            if (player.role == "Lobisomem") {
                werewolfPlayers.push(player.user)
                werewolfMessage += player.user + "\n"
            }
        }
    }


    for (var i = werewolfPlayers.length - 1; i >= 0; i--) {
        werewolfPlayers[i].send(werewolfMessage)
    }

}

function getGameRoles(game){
    if (!game.gameRoles) {
        game.gameRoles = defaultGameRoles
    }

    return game.gameRoles
}

function setupGame(message) {
    if (!(message.channel.id in games)) {
        //TODO: improve this message
        message.reply('Esse não é um canal de jogo! Para criar um novo jogo digite `!creategame`'); 
        
        return false
    }
    var game = games[message.channel.id]
    var currentGameRoles = getGameRoles(game)

    var players = game.players
    game.conditions = []
    for (var key in players) {
        if (players.hasOwnProperty(key)) {
            var player = players[key]  
            var roleIndex = Math.floor(Math.random()*currentGameRoles.length)
            var randomRole = currentGameRoles.splice(roleIndex,1)[0];
            player["role"] = randomRole
            player.user.send(`Ei! Psiu! Seu papel no jogo é ${randomRole}`)
            if (randomRole != "Aldeão") {
                game.conditions.push(randomRole)
            }
        }
    }

    broadcastWerewolves(players)
    startNight(game)
}

function getWerewolfKillPickMessage(players){
    var embed = new Discord.RichEmbed()
    embed.setTitle("É hora da que? É hora da matança!")
    embed.setAuthor("Game Master", "https://i.imgur.com/lm8s41J.png")
      /*
       * Alternatively, use "#00AE86", [0, 174, 134] or an integer number.
       */
    embed.setColor("#00AE86")
    embed.setDescription("Está na hora de escolher alguém para assasinar! Discuta com os outros lobisomens, escolha alguma das opções a baixo e me envie a tag associada!")
      /*
       * Inline fields may not display as inline if the thumbnail and/or image is too big.
       */
    var playersText = ""
    for (var key in players) {
        if (players.hasOwnProperty(key)) {
            var player = players[key]
            playersText += player.user.tag + "\n"
        }
    }
    embed.addField("Jogadores:", playersText)
      /*
       * Blank field, useful to create some space.
       */
    embed.addBlankField(true)
    embed.setFooter("O voto será do primeiro lobisomem que responder algum voto valido")
    embed.setTimestamp()
     
    return embed
}

function getMayorPickMessage(players){
    var embed = new Discord.RichEmbed()
    embed.setTitle("Eleições!")
    embed.setAuthor("Game Master", "https://i.imgur.com/lm8s41J.png")
    embed.setColor("#00AE86")
    embed.setDescription("Está na hora de escolher o prefeito! Votem aqui utilizando as seguites tags:")
    var playersText = ""
    for (var key in players) {
        if (players.hasOwnProperty(key)) {
            var player = players[key]
            playersText += player.user.tag + "\n"
        }
    }
    embed.addField("Candidatos:", playersText)
   
    embed.addBlankField(true)
    embed.setFooter("Apenas um voto por pessoa")
    embed.setTimestamp()
     
    return embed
}

function getDeathPickMessage(players){
    var embed = new Discord.RichEmbed()
    embed.setTitle("Julgamento!")
    embed.setAuthor("Game Master", "https://i.imgur.com/lm8s41J.png")
    embed.setColor("#00AE86")
    embed.setDescription("Está na hora de escolher quem será sentenciado a morte! Votem aqui utilizando as seguites tags:")
    var playersText = ""
    for (var key in players) {
        if (players.hasOwnProperty(key)) {
            var player = players[key]
            playersText += player.user.tag + "\n"
        }
    }
    embed.addField("Suspeitos:", playersText)
   
    embed.addBlankField(true)
    embed.setFooter("Apenas um voto por pessoa")
    embed.setTimestamp()
     
    return embed
}

function startNight(game) {
    var players = game.players
    //The city sleeps...
    game.gameChannel.send("A cidade dorme... O que será que vai acontecer?")
    var werewolfPlayersMessage = getWerewolfKillPickMessage(players)
    for (var key in players) {
        if (players.hasOwnProperty(key)) {
            var player = players[key]
            if (player.state != "dead") {
                //send message to 'wolves
                if (player.role == "Lobisomem") {
                    player.user.send(werewolfPlayersMessage)
                }

                //send message to doctor
                if (player.role == "Médico") {
                    player.user.send("Escolha alguém para salvar durante a noite!")
                    player.user.send("Você pode se escolher!")
                }

                //send message to seer
                if (player.role == "Vidente") {
                    player.user.send("Escolha alguém e irei revelar se essa pessoa é ou não um Lobisomem!")
                }

                //send message to villagers
                if (player.role == "Aldeão") {
                    player.user.send("The night is dark and full of terrors...")
                }
            }
        }
    }
    game["currentStage"] = "night"
}

function getGameByDM(message) {
    for (var key in games) {
        if (games.hasOwnProperty(key)) {
            var game = games[key]
            var players = game.players

            for (var key in players) {
                if (players.hasOwnProperty(key)) {

                    var player = players[key]
                    if (message.author == player.user) {
                        return game
                    }
                }
            }
        }
    }
}

function arrayContainsArray (superset, subset) {
    if (0 === subset.length) {
        return false;
    }
        return subset.every(function (value) {
        return (superset.indexOf(value) >= 0);
    });
}


function getAllPlayerTags (players) {
    var playerTags = []
    for (var key in players) {
        if (players.hasOwnProperty(key)) { 
            player = players[key]
            playerTags.push(player.user.tag)
        }
    }

    return playerTags
}

function isAPlayerMention(players, message){
    for (var key in players) {
        if (players.hasOwnProperty(key)) {
            var player = players[key]
            if (message.content.replace(/[\\<>@&!]/g, "") == player.user.tag) {
                return player
            }
        }
    }
}

function getElectionWinnerId(canditates){
    var mostCommonElement
    var mostCommonElementCount = 0

    for(var key in canditates){
        if(canditates.hasOwnProperty(key)){
            if(canditates[key] > mostCommonElementCount){
                mostCommonElement = key
                mostCommonElementCount = canditates[key]
            }
        }
    }

    return mostCommonElement
}

function getPlayerById(players, id) {
    for(var key in players){
        if(players.hasOwnProperty(key)){
            if(players[key].user.id == id){
                return players[key]
            }
        }
    }
}

function handleNightResponse(game, message) {
    if (!(message.author.id in game.players)) {
        return
    }

    var player = game.players[message.author.id]

    var mentionedPlayer = isAPlayerMention(game.players, message)

    if (!mentionedPlayer) {
        return
    }

    if (!game.conditionsMet) {
        game.conditionsMet = []
    }

    var deadPlayer
    var savedPlayer

    switch(player.role){
        case 'Lobisomem':
            game.conditionsMet.push("Lobisomem")
            var werewolfPlayers = getWerewolfPlayers(game.players)
            for (var key in werewolfPlayers) {
                if (werewolfPlayers.hasOwnProperty(key)) { 
                    werewolfPlayer = werewolfPlayers[key]
                    werewolfPlayer.send(`O jogador escolhido para morrer foi ${mentionedPlayer.user.username}`); 
                }
            }
            game["lastPlayerKilled"] = mentionedPlayer
        break;
        case 'Médico':
            game.conditionsMet.push("Médico")
            player.user.send(`O jogador escolhido para ser salvo foi ${mentionedPlayer.user.username}`); 
            savedPlayer = mentionedPlayer
            game["lastPlayerSaved"] = mentionedPlayer
        break;
        case 'Vidente':
            game.conditionsMet.push("Vidente")
            var result
            if (mentionedPlayer in getWerewolfPlayers(players)) {
                result = `O jogador ${mentionedPlayer.user.username} é um Lobisomem Oo`
            }
            else{
                result = `O jogador ${mentionedPlayer.user.username} não é um Lobisomem (ufa!)`
            }

            player.user.send(result)
        break;
    }

    if (arrayContainsArray (game.conditionsMet, game.conditions)) {
        startDay(game)
    }
        
}

function startDay(game) {
    game["currentStage"] = "mayorVote"
    var deadPlayer = game["lastPlayerKilled"]
    var savedPlayer = game["lastPlayerSaved"]

    //send players what happend dureing the night
    if (deadPlayer == savedPlayer) {
        game.gameChannel.send(`O jogador ${deadPlayer.user.username} foi SALVO!!!`)
    }
    else if(deadPlayer){
        game.gameChannel.send(`O jogador ${deadPlayer.user.username} está morto :rip:`)
        delete game.players[deadPlayer.user.id];
    }

    var winner = isGameOver(game)
    if (winner) {
        game.gameChannel.send(`Fim de Jogo! Os ${winner} ganharam!`)
        delete games[game.id]
        return
    }

    delete games["lastPlayerKilled"]
    delete games["lastPlayerSaved"]

    //send to players message to vote for the mayor
    game.gameChannel.send(getMayorPickMessage(game.players))
}



function isGameOver(game){
    var werewolfPlayers = getWerewolfPlayers(game)
    
    console.log(Math.ceil(Object.keys(game.players).length/2))

    if (werewolfPlayers.length >= Math.ceil(Object.keys(game.players).length/2)) {
        return "Lobisomens"
    } else if(werewolfPlayers.length == 0){
        return "Aldeões"
    }

    return false
}

function handleVotting(game, message){
    var mentionedPlayer = isAPlayerMention(game.players, message)
    if (!mentionedPlayer) {
        return
    }

    if (!game.voters) {
        game.voters = []
    }

    if (message.author.tag in game.voters) {
        return
    }

    if (!game.candidates) {
        game.candidates = {}
    }

    game.voters.push(message.author.tag)

    if (!game.candidates[mentionedPlayer.user.id]) {
        game.candidates[mentionedPlayer.user.id] = 0
    }

    game.candidates[mentionedPlayer.user.id]++
}

function handleMayorVoteResponse(game, message) {
    handleVotting(game, message)
    var playerTags = getAllPlayerTags(game.players)

    if (arrayContainsArray (game.voters, playerTags)) { //everybody voted
        game.mayor = getPlayerById(game.players, getElectionWinnerId(game.candidates))
        game.gameChannel.send(`Parabéns ${game.mayor.user.username}! Você é o novo prefeito!`)
        game.gameChannel.send(getDeathPickMessage(game.players))
        delete game.voters
        delete game.candidates
        game["currentStage"] = "deathVote"
    }
}

function handleDeathVoteResponse(game, message) {
    handleVotting(game, message)
    var playerTags = getAllPlayerTags(game.players)

    if (arrayContainsArray (game.voters, playerTags)) { //everybody voted
        var deadPlayer = getPlayerById(game.players, getElectionWinnerId(game.candidates))
        game.gameChannel.send(`O jogador ${deadPlayer.user.username} foi sentenciado a morte!`)
        delete game.players[deadPlayer.user.id];
        delete game.voters 
        delete game.candidates 

        var winner = isGameOver(game)
        if (winner) {
            game.gameChannel.send(`Fim de Jogo! Os ${winner} ganharam!`)
            delete games[game.id]
            return
        }

        startNight(game)
    }
}


client.on('message', function (message) {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    if (message.author == client.user) {
        return
    }
    if (message.content.substring(0, 1) == '!') {
        var args = message.content.substring(1).split(' ');
        var cmd = args[0];
        
        args = args.splice(1);
        gameName = args[0]
        switch(cmd) {
            // !ping
            case 'create':
                handleGameCreation(message)
            break;

            case 'configure':
                handleGameConfiguration(message)
            break;

            case 'ready':
                handleGameReady(message)
            break;

            case 'start':
                setupGame(message)
            break;
         }
    }else{
        var game = getGameByDM(message)
        if (!game) {
            return
        }

        if (message.channel.type == "dm") {
            if (game.currentStage == "night"){
                handleNightResponse(game, message)
            }
        }
        else {
            switch(game.currentStage){
                case "mayorVote":
                    handleMayorVoteResponse(game, message)
                break;
                case "deathVote":
                    handleDeathVoteResponse(game, message)
                break;
            }
        }
    }
    
});

process.on('SIGINT', function() {
    promiseList = []
    for (var key in games) {
        if (games.hasOwnProperty(key)) {           
            if (games[key].gameChannel.parent) {
                promiseList.push(games[key].gameChannel.parent.delete()
                  .then(deleted => console.log(`Deleted ${deleted.name} to cleanup`))
                  .catch(console.error));
            }

            promiseList.push(games[key].gameChannel.delete()
              .then(deleted => console.log(`Deleted ${deleted.name} to cleanup`))
              .catch(console.error));
        }
    }

    Promise.all(promiseList).then(function(values) {
        process.exit()
    });
});