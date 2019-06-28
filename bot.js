const Discord = require('discord.js');

var usersPlayingGames = {};
var games = {};
// var defaultGameRoles = ["Lobisomen", "Lobisomen", "Médico", "Vidente", "Aldeão", "Aldeão", "Aldeão"];
// var defaultGameRoles = ["Lobisomen"];
var defaultGameRoles = ["Lobisomen", "Médico"];
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
            message.channel.send(`Vamos jogar Lobisomen? Todos que queiram jogar entrem nesse link e mandem um ` + `!ready` + ` ! ${invite.url}`);
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
            if (player.role == "Lobisomen") {
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
            if (player.role == "Lobisomen") {
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

function startNight(game) {
    var players = game.players
    //The city sleeps...
    game.gameChannel.send("A cidade dorme... O que será que vai acontecer?")

    for (var key in players) {
        if (players.hasOwnProperty(key)) {
            var player = players[key]
            if (player.state != "dead") {
                //send message to 'wolves
                if (player.role == "Lobisomen") {
                    player.user.send("Lobisomen! converse com os seus companheiros e escolham alguém para assasinar!")
                    player.user.send("O primeiro nome que eu receber de um Lobisomen será o escolhido para morrer!")
                }

                //send message to doctor
                if (player.role == "Médico") {
                    player.user.send("Escolha alguém para salvar durante a noite!")
                    player.user.send("Você pode se escolher!")
                }

                //send message to seer
                if (player.role == "Vidente") {
                    player.user.send("Escolha alguém e irei revelar se essa pessoa é ou não um Lobisomen!")
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
        case 'Lobisomen':
            game.conditionsMet.push("Lobisomen")
            deadPlayer = mentionedPlayer
        break;
        case 'Médico':
            game.conditionsMet.push("Médico")
            savedPlayer = mentionedPlayer
        break;
        case 'Vidente':
            game.conditionsMet.push("Vidente")
            var result
            if (mentionedPlayer in getWerewolfPlayers(players)) {
                result = `O jogador ${mentionedPlayer.user.username} é um Lobisomen Oo`
            }
            else{
                result = `O jogador ${mentionedPlayer.user.username} não é um Lobisomen (ufa!)`
            }

            player.user.send(result)
        break;
    }

    if (arrayContainsArray (game.conditionsMet, game.conditions)) {
        startDay(game, deadPlayer, savedPlayer)
    }
        
}

function startDay(game, deadPlayer, savedPlayer) {
    game["currentStage"] = "mayorVote"

    //send players what happend dureing the night
    if (deadPlayer == savedPlayer) {
        game.gameChannel.send(`O jogador ${deadPlayer.user.username} foi SALVO!!!`)
    }
    else{
        game.gameChannel.send(`O jogador ${deadPlayer.user.username} está morto :rip:`)
        delete game.players[deadPlayer.id];
    }

    //send to players message to vote for the mayor
    game.gameChannel.send(`Votem no prefeito! (mencionando o jogador nesse canal!)`)
}

function getMostFrequentElement(arr){
    return arr.sort((a,b) =>
          arr.filter(v => v===a).length
        - arr.filter(v => v===b).length
    ).pop();
}

function handleMayorVoteResponse(game, message) {
    console.log("handleMayorVoteResponse")
    var mentionedPlayer = isAPlayerMention(game.players, message)
    console.log(mentionedPlayer)
    if (!mentionedPlayer) {
        return
    }

    if (!game.voters) {
        game.voters = []
    }

    if (!game.candidates) {
        game.candidates = []
    }


    game.voters.push(message.author)
    game.candidates.push(mentionedPlayer.username)
    console.log(game.voters)
    console.log(game.players)

    if (arrayContainsArray (game.voters, game.players)) { //everybody voted
        game.mayor = getMostFrequentElement(game.candidates)
        console.log(game.mayor)
    }
}

function handleDeathVoteResponse(game, message) {
    var mentionedPlayer = isAPlayerMention(game.players, message)

    if (!mentionedPlayer) {
        return
    }
    //handle player messages

    //show killed player

    //start night if game isnt over
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
        console.log(game.currentStage)

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