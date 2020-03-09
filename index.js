const express = require("express");
const app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

app.use(express.static("public"));

var CHAT_LOG_SIZE = 200;

var userDict = [];
var chatLog = [];
var hexChars = ['0','1','2','3','4','5','6','7','8','9','A','B', 'C','D','E','F','a','b','c','d','e','f'];

function randUsername() {
	var randUN = "User" + Math.floor(1000 + Math.random() * 9000);
	for (var i = 0; i < userDict.length; i++) {
		if (userDict[i].username == randUN) {
			// This username is not unique, try again
			randUN = "User" + Math.floor(1000 + Math.random() * 9000);
			i = 0;
		}
	}
	return randUN;
}

function addUserAndNotify(socketID) {
	userDict.push({
		socketID:	socketID,
		username:	randUsername(),
		chatColor:	"000000"
	});
	
	io.emit('chat history', chatLog, socketID, getUsername(socketID));
	userUpdate(socketID);
}

function getUserIndexFromID(socketID) {
	var i = -1;
	for (i = 0; i < userDict.length; i++) {
		if (userDict[i].socketID == socketID) {
			return i;
		}
	}
	return i;
}

function removeUser(socketID) {
	userDict.splice(getUserIndexFromID(socketID), 1);
} 

function getUsername(socketID) {
	return userDict[getUserIndexFromID(socketID)].username;
}

function getChatColor(socketID) {
	return userDict[getUserIndexFromID(socketID)].chatColor;
}

function setChatColor(socketID, chatColor) {
	userDict[getUserIndexFromID(socketID)].chatColor = chatColor;
	var msg = getTimeStamp() + ' <span style="color:#' + chatColor + ';">' + getUsername(socketID) + '</span> ' + " changed chat color";
	sendAndStoreMsg(msg, socketID);
}

function isRRGGBB(color) {
	if (color.length != 6) {
		return false;
	}
	else {
		var validChar = false;
		for (var i = 0; i < color.length; i++) {
			for (var j = 0; j < hexChars.length; j++) {
				if (color[i] == hexChars[j]) {
					// Valid character
					validChar = true;
					break;
				}
			}
			if (!validChar) {
				return false;
			}
			else {
				// Is a valid char, reset for next loop
				validChar = false;
			}
		}
		return true;
	}
}

function getTimeStamp() {
	var date = new Date();
	var ret = "";
	if (date.getHours() < 10) {
		// Less that 10, add leading 0
		ret += "0";
	}
	ret += date.getHours() + ":";
	if (date.getMinutes() < 10) {
		// Less that 10, add leading 0
		ret += "0";
	}
	ret += date.getMinutes();
	return ret;
}

function getUserList() {
	var userList = [];
	for (var i = 0; i < userDict.length; i++) {
		userList.push(userDict[i].username);
	}
	return userList;
}

function isAvailable(username) {
	var available = true;
	for (var i = 0; i < userDict.length; i++) {
		if (userDict[i].username == username) {
			// We have a duplicate
			available = false;
			break;
		}
	}
	return available;
}

function setUsername(socketID, newUsername) {
	var prevUsername = getUsername(socketID);
	
	userDict[getUserIndexFromID(socketID)].username = newUsername;

	// Emit a message saying we changed chat color
	msg = getTimeStamp() + ' <span style="color:#' + getChatColor(socketID) + ';">' + newUsername + '</span>: ' + " username changed from " + prevUsername + " to " + newUsername;
	
	sendAndStoreMsg(msg, socketID);
	userUpdate(socketID);	
}

function sendAndStoreMsg(msg, socketID) {
	chatLog[chatLog.length] = {
		message:	msg,
		socketID:	socketID,
		chatColor:	getChatColor(socketID)
	};
	
	if (chatLog.length > CHAT_LOG_SIZE) {
		// If the new message took us above log size, remove the last element 
		chatLog.splice(0, 1);
	}
	
	io.emit('chat message', msg, socketID, getChatColor(socketID));
}

function userUpdate(socketID) {
	io.emit('user update', getUserList(), socketID, getUsername(socketID));
}

function errorMsg(socketID, msg) {
	io.emit('error message', getTimeStamp() + " Error: " + msg, socketID);
}

io.on('connection', function(socket) {
	addUserAndNotify(socket.id);

	socket.on('disconnect', function() {
		userUpdate(socket.id);
		removeUser(socket.id);
	});
		
	socket.on('chat message', function(msg) {
		var splitMsg = msg.split(" ");
		if (splitMsg[0] == '/nickcolor' && splitMsg.length == 2) {
			// We have a nickcolor change request
			if (isRRGGBB(splitMsg[1])) {
				// Valid color passed, set it
				setChatColor(socket.id, splitMsg[1]);
			}
			else {
				errorMsg(socket.id, splitMsg[1] + " is not a valid RRGGBB color.");
			}
		}
		else if (splitMsg[0] == '/nick' && splitMsg.length == 2) {
			// We have a nickname change request
			if (isAvailable(splitMsg[1])) {
				// Username is available, set it
				setUsername(socket.id, splitMsg[1]);
			}
			else {
				errorMsg(socket.id, " The username " + splitMsg[1] + " is not available.");
			}
		}
		else if (msg[0] == '/') {
			errorMsg(socket.id, " Unrecognized / command.");
		}
		else {
			// We have a regular chat message
			msg = getTimeStamp() + ' <span style="color:#' + getChatColor(socket.id) + ';">' + getUsername(socket.id) + '</span>: ' + msg;
			sendAndStoreMsg(msg, socket.id);
		}
	});
});

http.listen(3000, function() {
  console.log('listening on *:3000');
});

