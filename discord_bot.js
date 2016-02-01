var Discord = require("discord.js");
var request = require("request");

var AuthDetails = require("./auth.json");

var bot = new Discord.Client();

bot.on("ready", function() {
    console.log("Bot ready!");
});

bot.on("presence", function(user,status,gameId) {
/*
    if (i === 0) {
        i++;
        for (var property in user) {
            console.log("USER: " + property);
        }
        for (var property in status) {
            console.log("STATUS: " + property);
        }
    }

    console.log(user.status);

    if(user.status != 'offline'){
        bot.sendMessage("Ohayo " + user.username + "~! (´•ω•｀)")
    }
*/
});

bot.on("message", function(msg) {

    var command = msg.content.split(/\s(.+)?/)[0];
    var args = msg.content.split(/\s(.+)?/)[1];

    console.log(command);
    console.log(args);

    if (['!img', '!himg'].indexOf(command) >= 0) {
        console.log("image");
        var page = 1;
        var nsfw = '';
        if (command === ('!himg')) {
            nsfw = "hentai+";           
        }

        request("https://www.googleapis.com/customsearch/v1?key=" + AuthDetails.youtube_api_key + "&cx=" + AuthDetails.google_custom_search + "&q=" + nsfw + (args.replace(/\s/g, '+')) + "&searchType=image&alt=json&num=10&start="+page, function(err, res, body) {
            var data, error;
            try {
                data = JSON.parse(body);
            } catch (error) {
                console.log(error)
                return;
            }
            if(!data){
                console.log(data);
                bot.sendMessage(msg.channel, "Error:\n" + JSON.stringify(data));
                return;
            }
            else if (!data.items || data.items.length == 0){
                console.log(data);
                bot.sendMessage(msg.channel, "No result for '" + args + "'");
                return;
            }
            var randResult = data.items[Math.floor(Math.random() * data.items.length)];
            bot.sendMessage(msg.channel, "Result for \"" + args + "\"\n" + randResult.link);
        });
    }

    if (msg.content === "ping") {
        bot.sendMessage(msg.channel, "pong!");

        console.log(msg);
    }

    if (msg.content.toLowerCase().indexOf("who do you love?") === 0) {
        bot.sendMessage(msg.channel, "I love Tippy!! (´•ω•｀)");

        console.log(msg);
    }

    if (msg.content.toLowerCase().indexOf("chitoge is the best") > -1) {
        bot.sendMessage(msg.channel, "https://jusanimanga.files.wordpress.com/2014/05/vlcsnap-2014-05-25-01h50m39s34.png");

        console.log(msg);
    }

});


bot.login(AuthDetails.email, AuthDetails.password, function(error, token) {
    console.log(error);
});