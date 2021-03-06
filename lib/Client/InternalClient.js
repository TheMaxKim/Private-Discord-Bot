"use strict";

exports.__esModule = true;

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _superagent = require("superagent");

var _superagent2 = _interopRequireDefault(_superagent);

var _ws = require("ws");

var _ws2 = _interopRequireDefault(_ws);

var _ConnectionState = require("./ConnectionState");

var _ConnectionState2 = _interopRequireDefault(_ConnectionState);

var _querystring = require("querystring");

var _querystring2 = _interopRequireDefault(_querystring);

var _Constants = require("../Constants");

var _UtilCache = require("../Util/Cache");

var _UtilCache2 = _interopRequireDefault(_UtilCache);

var _ResolverResolver = require("./Resolver/Resolver");

var _ResolverResolver2 = _interopRequireDefault(_ResolverResolver);

var _StructuresUser = require("../Structures/User");

var _StructuresUser2 = _interopRequireDefault(_StructuresUser);

var _StructuresChannel = require("../Structures/Channel");

var _StructuresChannel2 = _interopRequireDefault(_StructuresChannel);

var _StructuresTextChannel = require("../Structures/TextChannel");

var _StructuresTextChannel2 = _interopRequireDefault(_StructuresTextChannel);

var _StructuresVoiceChannel = require("../Structures/VoiceChannel");

var _StructuresVoiceChannel2 = _interopRequireDefault(_StructuresVoiceChannel);

var _StructuresPMChannel = require("../Structures/PMChannel");

var _StructuresPMChannel2 = _interopRequireDefault(_StructuresPMChannel);

var _StructuresServer = require("../Structures/Server");

var _StructuresServer2 = _interopRequireDefault(_StructuresServer);

var _StructuresMessage = require("../Structures/Message");

var _StructuresMessage2 = _interopRequireDefault(_StructuresMessage);

var _StructuresRole = require("../Structures/Role");

var _StructuresRole2 = _interopRequireDefault(_StructuresRole);

var _StructuresInvite = require("../Structures/Invite");

var _StructuresInvite2 = _interopRequireDefault(_StructuresInvite);

var _VoiceVoiceConnection = require("../Voice/VoiceConnection");

var _VoiceVoiceConnection2 = _interopRequireDefault(_VoiceVoiceConnection);

var _UtilTokenCacher = require("../Util/TokenCacher");

var _UtilTokenCacher2 = _interopRequireDefault(_UtilTokenCacher);

var zlib;
var libVersion = require('../../package.json').version;

function waitFor(condition) {
	var value = arguments.length <= 1 || arguments[1] === undefined ? condition : arguments[1];
	var interval = arguments.length <= 2 || arguments[2] === undefined ? 20 : arguments[2];
	return (function () {
		return new Promise(function (resolve) {
			var int = setInterval(function () {
				var isDone = condition();
				if (isDone) {
					if (condition === value) {
						resolve(isDone);
					} else {
						resolve(value(isDone));
					}
					return clearInterval(int);
				}
			}, interval);
		});
	})();
}

function delay(ms) {
	return new Promise(function (resolve) {
		return setTimeout(resolve, ms);
	});
}

var InternalClient = (function () {
	function InternalClient(discordClient) {
		_classCallCheck(this, InternalClient);

		this.setup(discordClient);
	}

	InternalClient.prototype.apiRequest = function apiRequest(method, url, useAuth, data, file) {
		var _this = this,
		    _arguments = arguments;

		var ret = _superagent2["default"][method](url);
		if (useAuth) {
			ret.set("authorization", this.token);
		}
		if (data) {
			ret.send(data);
		}
		if (file) {
			ret.attach("file", file.file, file.name);
		}
		ret.set('User-Agent', this.userAgentInfo.full);
		return new Promise(function (resolve, reject) {
			ret.end(function (error, data) {
				if (error) {
					if (!_this.client.options.rate_limit_as_error && error.response && error.response.error && error.response.error.status && error.response.error.status === 429) {

						if (data.headers["retry-after"] || data.headers["Retry-After"]) {
							var toWait = data.headers["retry-after"] || data.headers["Retry-After"];
							toWait = parseInt(toWait);
							setTimeout(function () {
								_this.apiRequest.apply(_this, _arguments).then(resolve)["catch"](reject);
							}, toWait);
						} else {
							return reject(error);
						}
					} else {
						return reject(error);
					}
				} else {
					resolve(data.body);
				}
			});
		});
	};

	InternalClient.prototype.setup = function setup(discordClient) {
		discordClient = discordClient || this.client;
		this.client = discordClient;
		this.state = _ConnectionState2["default"].IDLE;
		this.websocket = null;
		this.userAgent = {
			url: 'https://github.com/hydrabolt/discord.js',
			version: require('../../package.json').version
		};

		if (this.client.options.compress) {
			zlib = require("zlib");
		}

		// creates 4 caches with discriminators based on ID
		this.users = new _UtilCache2["default"]();
		this.channels = new _UtilCache2["default"]();
		this.servers = new _UtilCache2["default"]();
		this.private_channels = new _UtilCache2["default"]();

		this.intervals = {
			typing: [],
			kai: null,
			misc: []
		};

		this.voiceConnection = null;
		this.resolver = new _ResolverResolver2["default"](this);
		this.readyTime = null;
		this.messageAwaits = {};

		this.tokenCacher = new _UtilTokenCacher2["default"](this.client);
		this.tokenCacher.init(0);
	};

	InternalClient.prototype.cleanIntervals = function cleanIntervals() {
		for (var _iterator = this.intervals.typing.concat(this.intervals.misc).concat(this.intervals.kai), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
			var _ref;

			if (_isArray) {
				if (_i >= _iterator.length) break;
				_ref = _iterator[_i++];
			} else {
				_i = _iterator.next();
				if (_i.done) break;
				_ref = _i.value;
			}

			var interval = _ref;

			if (interval) {
				clearInterval(interval);
			}
		}
	};

	InternalClient.prototype.disconnected = function disconnected() {
		var forced = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

		this.cleanIntervals();

		this.leaveVoiceChannel();

		if (this.client.options.revive && !forced) {
			this.setup();

			// Check whether the email is set (if not, only a token has been used for login)
			if (this.email) {
				this.login(this.email, this.password);
			} else {
				this.loginWithToken(this.token);
			}
		}

		this.client.emit("disconnected");
	};

	//def leaveVoiceChannel

	InternalClient.prototype.leaveVoiceChannel = function leaveVoiceChannel() {
		if (this.voiceConnection) {
			this.voiceConnection.destroy();
			this.voiceConnection = null;
		}
		return Promise.resolve();
	};

	//def awaitResponse

	InternalClient.prototype.awaitResponse = function awaitResponse(msg) {
		var _this2 = this;

		return new Promise(function (resolve, reject) {

			msg = _this2.resolver.resolveMessage(msg);

			if (!msg) {
				reject(new Error("message undefined"));
				return;
			}

			var awaitID = msg.channel.id + msg.author.id;

			if (!_this2.messageAwaits[awaitID]) {
				_this2.messageAwaits[awaitID] = [];
			}

			_this2.messageAwaits[awaitID].push(resolve);
		});
	};

	//def joinVoiceChannel

	InternalClient.prototype.joinVoiceChannel = function joinVoiceChannel(chann) {
		var _this3 = this;

		var channel = this.resolver.resolveVoiceChannel(chann);

		if (!channel) {
			return Promise.reject(new Error("voice channel does not exist"));
		}
		return this.leaveVoiceChannel().then(function () {
			return new Promise(function (resolve, reject) {
				var session,
				    token,
				    server = channel.server,
				    endpoint;

				var check = function check(m) {
					var data = JSON.parse(m);
					if (data.t === "VOICE_STATE_UPDATE") {
						session = data.d.session_id;
					} else if (data.t === "VOICE_SERVER_UPDATE") {
						token = data.d.token;
						endpoint = data.d.endpoint;
						var chan = _this3.voiceConnection = new _VoiceVoiceConnection2["default"](channel, _this3.client, session, token, server, endpoint);

						chan.on("ready", function () {
							return resolve(chan);
						});
						chan.on("error", reject);

						_this3.client.emit("debug", "removed temporary voice websocket listeners");
						_this3.websocket.removeListener("message", check);
					}
				};

				_this3.websocket.on("message", check);
				_this3.sendWS({
					op: 4,
					d: {
						"guild_id": server.id,
						"channel_id": channel.id,
						"self_mute": false,
						"self_deaf": false
					}
				});
			});
		});
	};

	// def createServer

	InternalClient.prototype.createServer = function createServer(name) {
		var _this4 = this;

		var region = arguments.length <= 1 || arguments[1] === undefined ? "london" : arguments[1];

		name = this.resolver.resolveString(name);

		return this.apiRequest('post', _Constants.Endpoints.SERVERS, true, { name: name, region: region }).then(function (res) {
			// valid server, wait until it is cached
			return waitFor(function () {
				return _this4.servers.get("id", res.id);
			});
		});
	};

	//def joinServer

	InternalClient.prototype.joinServer = function joinServer(invite) {
		var _this5 = this;

		invite = this.resolver.resolveInviteID(invite);
		if (!invite) {
			return Promise.reject(new Error("Not a valid invite"));
		}

		return this.apiRequest("post", _Constants.Endpoints.INVITE(invite), true).then(function (res) {
			// valid server, wait until it is received via ws and cached
			return waitFor(function () {
				return _this5.servers.get("id", res.guild.id);
			});
		});
	};

	//def updateServer

	InternalClient.prototype.updateServer = function updateServer(server, name, region) {
		var _this6 = this;

		var server = this.resolver.resolveServer(server);
		if (!server) {
			return Promise.reject(new Error("server did not resolve"));
		}

		return this.apiRequest("patch", _Constants.Endpoints.SERVER(server.id), true, { name: name || server.name, region: region || server.region }).then(function (res) {
			// wait until the name and region are updated
			return waitFor(function () {
				return _this6.servers.get("name", res.name) ? _this6.servers.get("name", res.name).region === res.region ? _this6.servers.get("id", res.id) : false : false;
			});
		});
	};

	//def leaveServer

	InternalClient.prototype.leaveServer = function leaveServer(srv) {
		var _this7 = this;

		var server = this.resolver.resolveServer(srv);
		if (!server) {
			return Promise.reject(new Error("server did not resolve"));
		}

		return this.apiRequest("del", _Constants.Endpoints.SERVER(server.id), true).then(function () {
			// remove channels of server then the server
			for (var _iterator2 = server.channels, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
				var _ref2;

				if (_isArray2) {
					if (_i2 >= _iterator2.length) break;
					_ref2 = _iterator2[_i2++];
				} else {
					_i2 = _iterator2.next();
					if (_i2.done) break;
					_ref2 = _i2.value;
				}

				var chan = _ref2;

				_this7.channels.remove(chan);
			}
			// remove server
			_this7.servers.remove(server);
		});
	};

	// def loginWithToken
	// email and password are optional

	InternalClient.prototype.loginWithToken = function loginWithToken(token, email, password) {
		var _this8 = this;

		this.state = _ConnectionState2["default"].LOGGED_IN;
		this.token = token;
		this.email = email;
		this.password = password;

		return this.getGateway().then(function (url) {
			_this8.createWS(url);
			return token;
		});
	};

	// def login

	InternalClient.prototype.login = function login(email, password) {
		var _this9 = this;

		var client = this.client;

		if (!this.tokenCacher.done) {
			return new Promise(function (resolve, reject) {
				setTimeout(function () {
					_this9.login(email, password).then(resolve)["catch"](reject);
				}, 20);
			});
		} else {
			var tk = this.tokenCacher.getToken(email, password);
			if (tk) {
				this.client.emit("debug", "bypassed direct API login, used cached token");
				return this.loginWithToken(tk, email, password);
			}
		}

		if (this.state !== _ConnectionState2["default"].DISCONNECTED && this.state !== _ConnectionState2["default"].IDLE) {
			return Promise.reject(new Error("already logging in/logged in/ready!"));
		}

		this.state = _ConnectionState2["default"].LOGGING_IN;

		return this.apiRequest("post", _Constants.Endpoints.LOGIN, false, {
			email: email,
			password: password
		}).then(function (res) {
			_this9.client.emit("debug", "direct API login, cached token was unavailable");
			var token = res.token;
			_this9.tokenCacher.setToken(email, password, token);
			return _this9.loginWithToken(token, email, password);
		}, function (error) {
			_this9.websocket = null;
			throw error;
		})["catch"](function (error) {
			_this9.state = _ConnectionState2["default"].DISCONNECTED;
			client.emit("disconnected");
			throw error;
		});
	};

	// def logout

	InternalClient.prototype.logout = function logout() {
		var _this10 = this;

		if (this.state === _ConnectionState2["default"].DISCONNECTED || this.state === _ConnectionState2["default"].IDLE) {
			return Promise.reject(new Error("Client is not logged in!"));
		}

		return this.apiRequest("post", _Constants.Endpoints.LOGOUT, true).then(function () {
			if (_this10.websocket) {
				_this10.websocket.close();
				_this10.websocket = null;
			}
			_this10.token = null;
			_this10.email = null;
			_this10.password = null;
			_this10.state = _ConnectionState2["default"].DISCONNECTED;
		});
	};

	// def startPM

	InternalClient.prototype.startPM = function startPM(resUser) {
		var _this11 = this;

		var user = this.resolver.resolveUser(resUser);
		if (!user) {
			return Promise.reject(new Error("Unable to resolve resUser to a User"));
		}
		// start the PM
		return this.apiRequest("post", _Constants.Endpoints.USER_CHANNELS(user.id), true, {
			recipient_id: user.id
		}).then(function (res) {
			return _this11.private_channels.add(new _StructuresPMChannel2["default"](res, _this11.client));
		});
	};

	// def getGateway

	InternalClient.prototype.getGateway = function getGateway() {
		return this.apiRequest("get", _Constants.Endpoints.GATEWAY, true).then(function (res) {
			return res.url;
		});
	};

	// def sendMessage

	InternalClient.prototype.sendMessage = function sendMessage(where, _content) {
		var _this12 = this;

		var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

		return this.resolver.resolveChannel(where).then(function (destination) {
			//var destination;
			var content = _this12.resolver.resolveString(_content);

			return _this12.apiRequest("post", _Constants.Endpoints.CHANNEL_MESSAGES(destination.id), true, {
				content: content,
				tts: options.tts
			}).then(function (res) {
				return destination.messages.add(new _StructuresMessage2["default"](res, destination, _this12.client));
			});
		});
	};

	// def deleteMessage

	InternalClient.prototype.deleteMessage = function deleteMessage(_message) {
		var _this13 = this;

		var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

		var message = this.resolver.resolveMessage(_message);
		if (!message) {
			return Promise.reject(new Error("Supplied message did not resolve to a message!"));
		}

		var chain = options.wait ? delay(options.wait) : Promise.resolve();
		return chain.then(function () {
			return _this13.apiRequest("del", _Constants.Endpoints.CHANNEL_MESSAGE(message.channel.id, message.id), true);
		}).then(function () {
			return message.channel.messages.remove(message);
		});
	};

	// def updateMessage

	InternalClient.prototype.updateMessage = function updateMessage(msg, _content) {
		var _this14 = this;

		var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

		var message = this.resolver.resolveMessage(msg);

		if (!message) {
			return Promise.reject(new Error("Supplied message did not resolve to a message!"));
		}

		var content = this.resolver.resolveString(_content);

		return this.apiRequest("patch", _Constants.Endpoints.CHANNEL_MESSAGE(message.channel.id, message.id), true, {
			content: content,
			tts: options.tts
		}).then(function (res) {
			return message.channel.messages.update(message, new _StructuresMessage2["default"](res, message.channel, _this14.client));
		});
	};

	// def sendFile

	InternalClient.prototype.sendFile = function sendFile(where, _file, name) {
		var _this15 = this;

		if (!name) {
			if (_file instanceof String || typeof _file === "string") {
				name = require("path").basename(_file);
			} else if (_file.path) {
				// fs.createReadStream()'s have .path that give the path. Not sure about other streams though.
				name = require("path").basename(_file.path);
			} else {
				name = "default.png"; // Just have to go with default filenames.
			}
		}

		return this.resolver.resolveChannel(where).then(function (channel) {
			return _this15.resolver.resolveFile(_file).then(function (file) {
				return _this15.apiRequest("post", _Constants.Endpoints.CHANNEL_MESSAGES(channel.id), true, null, {
					name: name,
					file: file
				}).then(function (res) {
					return channel.messages.add(new _StructuresMessage2["default"](res, channel, _this15.client));
				});
			});
		});
	};

	// def getChannelLogs

	InternalClient.prototype.getChannelLogs = function getChannelLogs(_channel) {
		var _this16 = this;

		var limit = arguments.length <= 1 || arguments[1] === undefined ? 50 : arguments[1];
		var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

		return this.resolver.resolveChannel(_channel).then(function (channel) {
			var qsObject = { limit: limit };
			if (options.before) {
				var res = _this16.resolver.resolveMessage(options.before);
				if (res) {
					qsObject.before = res.id;
				}
			}
			if (options.after) {
				var res = _this16.resolver.resolveMessage(options.after);
				if (res) {
					qsObject.after = res.id;
				}
			}

			return _this16.apiRequest("get", _Constants.Endpoints.CHANNEL_MESSAGES(channel.id) + "?" + _querystring2["default"].stringify(qsObject), true).then(function (res) {
				return res.map(function (msg) {
					return channel.messages.add(new _StructuresMessage2["default"](msg, channel, _this16.client));
				});
			});
		});
	};

	// def getBans

	InternalClient.prototype.getBans = function getBans(server) {
		var _this17 = this;

		server = this.resolver.resolveServer(server);

		return this.apiRequest("get", _Constants.Endpoints.SERVER_BANS(server.id), true).then(function (res) {
			return res.map(function (ban) {
				return _this17.users.add(new _StructuresUser2["default"](ban.user, _this17.client));
			});
		});
	};

	// def createChannel

	InternalClient.prototype.createChannel = function createChannel(server, name) {
		var _this18 = this;

		var type = arguments.length <= 2 || arguments[2] === undefined ? "text" : arguments[2];

		server = this.resolver.resolveServer(server);

		return this.apiRequest("post", _Constants.Endpoints.SERVER_CHANNELS(server.id), true, {
			name: name,
			type: type
		}).then(function (res) {
			var channel;
			if (res.type === "text") {
				channel = new _StructuresTextChannel2["default"](res, _this18.client, server);
			} else {
				channel = new _StructuresVoiceChannel2["default"](res, _this18.client, server);
			}
			return server.channels.add(_this18.channels.add(channel));
		});
	};

	// def deleteChannel

	InternalClient.prototype.deleteChannel = function deleteChannel(_channel) {
		var _this19 = this;

		return this.resolver.resolveChannel(_channel).then(function (channel) {
			return _this19.apiRequest("del", _Constants.Endpoints.CHANNEL(channel.id), true).then(function () {
				channel.server.channels.remove(channel);
				_this19.channels.remove(channel);
			});
		});
	};

	// def banMember

	InternalClient.prototype.banMember = function banMember(user, server) {
		var length = arguments.length <= 2 || arguments[2] === undefined ? 1 : arguments[2];

		user = this.resolver.resolveUser(user);
		server = this.resolver.resolveServer(server);

		return this.apiRequest("put", _Constants.Endpoints.SERVER_BANS(server.id) + "/" + user.id + "?delete-message-days=" + length, true);
	};

	// def unbanMember

	InternalClient.prototype.unbanMember = function unbanMember(user, server) {

		server = this.resolver.resolveServer(server);
		user = this.resolver.resolveUser(user);

		return this.apiRequest("del", _Constants.Endpoints.SERVER_BANS(server.id) + "/" + user.id, true);
	};

	// def kickMember

	InternalClient.prototype.kickMember = function kickMember(user, server) {
		user = this.resolver.resolveUser(user);
		server = this.resolver.resolveServer(server);

		return this.apiRequest("del", _Constants.Endpoints.SERVER_MEMBERS(server.id) + "/" + user.id, true);
	};

	// def moveMember

	InternalClient.prototype.moveMember = function moveMember(user, channel) {
		var _this20 = this;

		user = this.resolver.resolveUser(user);
		return this.resolver.resolveChannel(channel).then(function (channel) {
			var server = channel.server;

			// Make sure `channel` is a voice channel
			if (channel.type !== "voice") {
				throw new Error("Can't moveMember into a non-voice channel");
			} else {
				return _this20.apiRequest("patch", _Constants.Endpoints.SERVER_MEMBERS(server.id) + "/" + user.id, true, { channel_id: channel.id }).then(function (res) {
					user.voiceChannel = channel;
					return res;
				});
			}
		});
	};

	// def createRole

	InternalClient.prototype.createRole = function createRole(server, data) {
		var _this21 = this;

		server = this.resolver.resolveServer(server);

		return this.apiRequest("post", _Constants.Endpoints.SERVER_ROLES(server.id), true).then(function (res) {
			var role = server.roles.add(new _StructuresRole2["default"](res, server, _this21.client));

			if (data) {
				return _this21.updateRole(role, data);
			}
			return role;
		});
	};

	// def updateRole

	InternalClient.prototype.updateRole = function updateRole(role, data) {
		var _this22 = this;

		role = this.resolver.resolveRole(role);
		var server = this.resolver.resolveServer(role.server);

		var newData = {
			color: data.color || role.color,
			hoist: data.hoist || role.hoist,
			name: data.name || role.name,
			permissions: role.permissions || 0
		};

		if (data.permissions) {
			newData.permissions = 0;
			for (var _iterator3 = data.permissions, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
				var _ref3;

				if (_isArray3) {
					if (_i3 >= _iterator3.length) break;
					_ref3 = _iterator3[_i3++];
				} else {
					_i3 = _iterator3.next();
					if (_i3.done) break;
					_ref3 = _i3.value;
				}

				var perm = _ref3;

				if (perm instanceof String || typeof perm === "string") {
					newData.permissions |= _Constants.Permissions[perm] || 0;
				} else {
					newData.permissions |= perm;
				}
			}
		}

		return this.apiRequest("patch", _Constants.Endpoints.SERVER_ROLES(server.id) + "/" + role.id, true, newData).then(function (res) {
			return server.roles.update(role, new _StructuresRole2["default"](res, server, _this22.client));
		});
	};

	// def deleteRole

	InternalClient.prototype.deleteRole = function deleteRole(role) {
		return this.apiRequest("del", _Constants.Endpoints.SERVER_ROLES(role.server.id) + "/" + role.id, true);
	};

	//def addMemberToRole

	InternalClient.prototype.addMemberToRole = function addMemberToRole(member, roles) {
		var _this23 = this;

		member = this.resolver.resolveUser(member);

		if (!member) {
			return Promise.reject(new Error("user not found"));
		}

		if (!Array.isArray(roles) || roles.length === 0) {
			roles = this.resolver.resolveRole(roles);
			if (roles) {
				roles = [roles];
			} else {
				return Promise.reject(new Error("invalid array of roles"));
			}
		} else {
			roles = roles.map(function (r) {
				return _this23.resolver.resolveRole(r);
			});
		}

		if (roles.some(function (role) {
			return !role.server.memberMap[member.id];
		})) {
			return Promise.reject(new Error("Role does not exist on same server as member"));
		}

		var roleIDs = roles[0].server.memberMap[member.id].roles.map(function (r) {
			return r.id;
		});

		for (var i = 0; i < roles.length; i++) {
			if (! ~roleIDs.indexOf(roles[i].id)) {
				roleIDs.push(roles[i].id);
			};
		};

		console.log(roleIDs);

		return this.apiRequest("patch", _Constants.Endpoints.SERVER_MEMBERS(roles[0].server.id) + "/" + member.id, true, {
			roles: roleIDs
		});
	};

	InternalClient.prototype.memberHasRole = function memberHasRole(member, role) {
		role = this.resolver.resolveRole(role);
		member = this.resolver.resolveUser(member);

		if (!role) {
			throw new Error("invalid role");
		}
		if (!member) {
			throw new Error("user not found");
		}

		return !!role.server.rolesOf(member).find(function (r) {
			return r.id == role.id;
		});
	};

	//def removeMemberFromRole

	InternalClient.prototype.removeMemberFromRole = function removeMemberFromRole(member, roles) {
		var _this24 = this;

		member = this.resolver.resolveUser(member);

		if (!member) {
			return Promise.reject(new Error("user not found"));
		}

		if (!Array.isArray(roles) || roles.length === 0) {
			roles = this.resolver.resolveRole(roles);
			if (roles) {
				roles = [roles];
			} else {
				return Promise.reject(new Error("invalid array of roles"));
			}
		} else {
			roles = roles.map(function (r) {
				return _this24.resolver.resolveRole(r);
			});
		}

		var roleIDs = roles[0].server.memberMap[member.id].roles.map(function (r) {
			return r.id;
		});

		for (var _iterator4 = roles, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
			var _ref4;

			if (_isArray4) {
				if (_i4 >= _iterator4.length) break;
				_ref4 = _iterator4[_i4++];
			} else {
				_i4 = _iterator4.next();
				if (_i4.done) break;
				_ref4 = _i4.value;
			}

			var role = _ref4;

			if (!role.server.memberMap[member.id]) {
				return Promise.reject(new Error("member not in server"));
			}
			for (var item in roleIDs) {
				if (roleIDs[item] === role.id) {
					roleIDs.splice(item, 1);
					break;
				}
			}
		}

		return this.apiRequest("patch", _Constants.Endpoints.SERVER_MEMBERS(roles[0].server.id) + "/" + member.id, true, {
			roles: roleIDs
		});
	};

	// def createInvite

	InternalClient.prototype.createInvite = function createInvite(chanServ, options) {
		var _this25 = this;

		if (chanServ instanceof _StructuresChannel2["default"]) {
			// do something
		} else if (chanServ instanceof _StructuresServer2["default"]) {
				// do something
			} else {
					chanServ = this.resolver.resolveServer(chanServ) || this.resolver.resolveChannel(chanServ);
				}

		if (!chanServ) {
			throw new Error("couldn't resolve where");
		}

		if (!options) {
			options = {
				validate: null
			};
		} else {
			options.max_age = options.maxAge || 0;
			options.max_uses = options.maxUses || 0;
			options.temporary = options.temporary || false;
			options.xkcdpass = options.xkcd || false;
		}

		var epoint;
		if (chanServ instanceof _StructuresChannel2["default"]) {
			epoint = _Constants.Endpoints.CHANNEL_INVITES(chanServ.id);
		} else {
			epoint = _Constants.Endpoints.SERVER_INVITES(chanServ.id);
		}

		return this.apiRequest("post", epoint, true, options).then(function (res) {
			return new _StructuresInvite2["default"](res, _this25.channels.get("id", res.channel.id), _this25.client);
		});
	};

	//def deleteInvite

	InternalClient.prototype.deleteInvite = function deleteInvite(invite) {
		invite = this.resolver.resolveInviteID(invite);
		if (!invite) {
			throw new Error("Not a valid invite");
		}
		return this.apiRequest("del", _Constants.Endpoints.INVITE(invite), true);
	};

	//def getInvite

	InternalClient.prototype.getInvite = function getInvite(invite) {
		var _this26 = this;

		invite = this.resolver.resolveInviteID(invite);
		if (!invite) {
			return Promise.reject(new Error("Not a valid invite"));
		}

		return this.apiRequest("get", _Constants.Endpoints.INVITE(invite), true).then(function (res) {
			if (!_this26.channels.has("id", res.channel.id)) {
				return new _StructuresInvite2["default"](res, null, _this26.client);
			}
			return _this26.apiRequest("post", _Constants.Endpoints.CHANNEL_INVITES(res.channel.id), true, { validate: invite }).then(function (res2) {
				return new _StructuresInvite2["default"](res2, _this26.channels.get("id", res.channel.id), _this26.client);
			});
		});
	};

	//def getInvites

	InternalClient.prototype.getInvites = function getInvites(channel) {
		var _this27 = this;

		if (!(channel instanceof _StructuresChannel2["default"])) {
			var server = this.resolver.resolveServer(channel);
			if (server) {
				return this.apiRequest("get", _Constants.Endpoints.SERVER_INVITES(server.id), true).then(function (res) {
					return res.map(function (data) {
						return new _StructuresInvite2["default"](data, _this27.channels.get("id", data.channel.id), _this27.client);
					});
				});
			}
		}
		return this.resolver.resolveChannel(channel).then(function (channel) {
			return _this27.apiRequest("get", _Constants.Endpoints.CHANNEL_INVITES(channel.id), true).then(function (res) {
				return res.map(function (data) {
					return new _StructuresInvite2["default"](data, _this27.channels.get("id", data.channel.id), _this27.client);
				});
			});
		});
	};

	//def overwritePermissions

	InternalClient.prototype.overwritePermissions = function overwritePermissions(channel, role, updated) {
		var _this28 = this;

		return this.resolver.resolveChannel(channel).then(function (channel) {
			var user;
			if (role instanceof _StructuresUser2["default"]) {
				user = role;
			} else {
				role = _this28.resolver.resolveRole(role);
			}

			var data = {};
			data.allow = 0;
			data.deny = 0;

			updated.allow = updated.allow || [];
			updated.deny = updated.deny || [];

			if (role instanceof _StructuresRole2["default"]) {
				data.id = role.id;
				data.type = "role";
			} else if (user) {
				data.id = user.id;
				data.type = "member";
			} else {
				throw new Error("role incorrect");
			}

			for (var perm in updated) {
				if (updated[perm]) {
					if (perm instanceof String || typeof perm === "string") {
						data.allow |= _Constants.Permissions[perm] || 0;
					} else {
						data.allow |= perm;
					}
				} else {
					if (perm instanceof String || typeof perm === "string") {
						data.deny |= _Constants.Permissions[perm] || 0;
					} else {
						data.deny |= perm;
					}
				}
			}

			return _this28.apiRequest("put", _Constants.Endpoints.CHANNEL_PERMISSIONS(channel.id) + "/" + data.id, true, data);
		});
	};

	//def setStatus

	InternalClient.prototype.setStatus = function setStatus(idleStatus, game) {

		if (idleStatus === "online" || idleStatus === "here" || idleStatus === "available") {
			this.idleStatus = null;
		} else if (idleStatus === "idle" || idleStatus === "away") {
			this.idleStatus = Date.now();
		} else {
			this.idleStatus = this.idleStatus || null; //undefined
		}

		this.game = game === null ? null : game || this.game;

		var packet = {
			op: 3,
			d: {
				idle_since: this.idleStatus,
				game: {
					name: this.game
				}
			}
		};

		this.sendWS(packet);

		return Promise.resolve();
	};

	//def sendTyping

	InternalClient.prototype.sendTyping = function sendTyping(channel) {
		var _this29 = this;

		return this.resolver.resolveChannel(channel).then(function (channel) {
			return _this29.apiRequest("post", _Constants.Endpoints.CHANNEL(channel.id) + "/typing", true);
		});
	};

	//def startTyping

	InternalClient.prototype.startTyping = function startTyping(channel) {
		var _this30 = this;

		return this.resolver.resolveChannel(channel).then(function (channel) {

			if (_this30.intervals.typing[channel.id]) {
				// typing interval already exists, leave it alone
				throw new Error("Already typing in that channel");
			}

			_this30.intervals.typing[channel.id] = setInterval(function () {
				return _this30.sendTyping(channel)["catch"](function (error) {
					return _this30.emit("error", error);
				});
			}, 4000);

			return _this30.sendTyping(channel);
		});
	};

	//def stopTyping

	InternalClient.prototype.stopTyping = function stopTyping(channel) {
		var _this31 = this;

		return this.resolver.resolveChannel(channel).then(function (channel) {

			if (!_this31.intervals.typing[channel.id]) {
				// typing interval doesn"t exist
				throw new Error("Not typing in that channel");
			}

			clearInterval(_this31.intervals.typing[channel.id]);
			_this31.intervals.typing[channel.id] = false;
		});
	};

	//def updateDetails

	InternalClient.prototype.updateDetails = function updateDetails(data) {
		if (!email) {
			throw new Error("Can't use updateDetails because only a token has been used for login!");
		}
		return this.apiRequest("patch", _Constants.Endpoints.ME, true, {
			avatar: this.resolver.resolveToBase64(data.avatar) || this.user.avatar,
			email: data.email || this.email,
			new_password: data.newPassword || null,
			password: data.password || this.password,
			username: data.username || this.user.username
		});
	};

	//def setAvatar

	InternalClient.prototype.setAvatar = function setAvatar(avatar) {
		return this.updateDetails({ avatar: avatar });
	};

	//def setUsername

	InternalClient.prototype.setUsername = function setUsername(username) {
		return this.updateDetails({ username: username });
	};

	//def setChannelTopic

	InternalClient.prototype.setChannelTopic = function setChannelTopic(chann) {
		var _this32 = this;

		var topic = arguments.length <= 1 || arguments[1] === undefined ? "" : arguments[1];

		return this.resolver.resolveChannel(chann).then(function (channel) {
			return _this32.apiRequest("patch", _Constants.Endpoints.CHANNEL(channel.id), true, {
				name: channel.name,
				position: channel.position,
				topic: topic
			}).then(function (res) {
				return channel.topic = res.topic;
			});
		});
	};

	//def setChannelName

	InternalClient.prototype.setChannelName = function setChannelName(chann) {
		var _this33 = this;

		var name = arguments.length <= 1 || arguments[1] === undefined ? "discordjs_is_the_best" : arguments[1];

		return this.resolver.resolveChannel(chann).then(function (channel) {
			return _this33.apiRequest("patch", _Constants.Endpoints.CHANNEL(channel.id), true, {
				name: name,
				position: channel.position,
				topic: channel.topic
			}).then(function (res) {
				return channel.name = res.name;
			});
		});
	};

	//def setChannelNameAndTopic

	InternalClient.prototype.setChannelNameAndTopic = function setChannelNameAndTopic(chann) {
		var _this34 = this;

		var name = arguments.length <= 1 || arguments[1] === undefined ? "discordjs_is_the_best" : arguments[1];
		var topic = arguments.length <= 2 || arguments[2] === undefined ? "" : arguments[2];

		return this.resolver.resolveChannel(chann).then(function (channel) {
			return _this34.apiRequest("patch", _Constants.Endpoints.CHANNEL(channel.id), true, {
				name: name,
				position: channel.position,
				topic: topic
			}).then(function (res) {
				channel.name = res.name;
				channel.topic = res.topic;
			});
		});
	};

	//def setTopic

	InternalClient.prototype.setChannelPosition = function setChannelPosition(chann) {
		var _this35 = this;

		var position = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

		return this.resolver.resolveChannel(chann).then(function (channel) {
			return _this35.apiRequest("patch", _Constants.Endpoints.CHANNEL(channel.id), true, {
				name: channel.name,
				position: position,
				topic: channel.topic
			}).then(function (res) {
				return channel.position = res.position;
			});
		});
	};

	//def updateChannel

	InternalClient.prototype.updateChannel = function updateChannel(chann, data) {
		return this.setChannelNameAndTopic(chann, data.name, data.topic);
	};

	//def ack

	InternalClient.prototype.ack = function ack(msg) {
		msg = this.resolver.resolveMessage(msg);

		if (!msg) {
			Promise.reject(new Error("Message does not exist"));
		}

		return this.apiRequest("post", _Constants.Endpoints.CHANNEL_MESSAGE(msg.channel.id, msg.id) + "/ack", true);
	};

	InternalClient.prototype.sendWS = function sendWS(object) {
		if (this.websocket) {
			this.websocket.send(JSON.stringify(object));
		}
	};

	InternalClient.prototype.createWS = function createWS(url) {
		var self = this;
		var client = self.client;

		if (this.websocket) {
			return false;
		}

		this.websocket = new _ws2["default"](url);

		this.websocket.onopen = function () {

			self.sendWS({
				op: 2,
				d: {
					token: self.token,
					v: 3,
					compress: self.client.options.compress,
					properties: {
						"$os": "discord.js",
						"$browser": "discord.js",
						"$device": "discord.js",
						"$referrer": "discord.js",
						"$referring_domain": "discord.js"
					}
				}
			});
		};

		this.websocket.onclose = function () {
			self.websocket = null;
			self.state = _ConnectionState2["default"].DISCONNECTED;
			self.disconnected();
		};

		this.websocket.onerror = function (e) {
			client.emit("error", e);
		};

		this.websocket.onmessage = function (e) {
			if (e.data instanceof Buffer) {
				if (!zlib) zlib = require("zlib");
				e.data = zlib.inflateSync(e.data).toString();
			}

			var packet, data;
			try {
				packet = JSON.parse(e.data);
				data = packet.d;
			} catch (e) {
				client.emit("error", e);
				return;
			}

			client.emit("raw", packet);
			switch (packet.t) {

				case _Constants.PacketType.READY:
					var startTime = Date.now();
					self.intervals.kai = setInterval(function () {
						return self.sendWS({ op: 1, d: Date.now() });
					}, data.heartbeat_interval);

					self.user = self.users.add(new _StructuresUser2["default"](data.user, client));
					data.guilds.forEach(function (server) {
						if (!server.unavailable) {
							self.servers.add(new _StructuresServer2["default"](server, client));
						} else {
							client.emit("warn", "server was unavailable, could not create (ready)");
						}
					});
					data.private_channels.forEach(function (pm) {
						self.private_channels.add(new _StructuresPMChannel2["default"](pm, client));
					});
					self.state = _ConnectionState2["default"].READY;

					client.emit("ready");
					client.emit("debug", "ready packet took " + (Date.now() - startTime) + "ms to process");
					client.emit("debug", "ready with " + self.servers.length + " servers, " + self.channels.length + " channels and " + self.users.length + " users cached.");

					self.readyTime = Date.now();
					break;

				case _Constants.PacketType.MESSAGE_CREATE:
					// format: https://discordapi.readthedocs.org/en/latest/reference/channels/messages.html#message-format
					var channel = self.channels.get("id", data.channel_id) || self.private_channels.get("id", data.channel_id);
					if (channel) {
						var msg = channel.messages.add(new _StructuresMessage2["default"](data, channel, client));

						if (self.messageAwaits[channel.id + msg.author.id]) {
							self.messageAwaits[channel.id + msg.author.id].map(function (fn) {
								return fn(msg);
							});
							self.messageAwaits[channel.id + msg.author.id] = null;
							client.emit("message", msg, true); //2nd param is isAwaitedMessage
						} else {
								client.emit("message", msg);
							}
					} else {
						client.emit("warn", "message created but channel is not cached");
					}
					break;
				case _Constants.PacketType.MESSAGE_DELETE:
					// format https://discordapi.readthedocs.org/en/latest/reference/channels/messages.html#message-delete
					var channel = self.channels.get("id", data.channel_id) || self.private_channels.get("id", data.channel_id);
					if (channel) {
						// potentially blank
						var msg = channel.messages.get("id", data.id);
						client.emit("messageDeleted", msg, channel);
						if (msg) {
							channel.messages.remove(msg);
						}
					} else {
						client.emit("warn", "message was deleted but channel is not cached");
					}
					break;
				case _Constants.PacketType.MESSAGE_UPDATE:
					// format https://discordapi.readthedocs.org/en/latest/reference/channels/messages.html#message-format
					var channel = self.channels.get("id", data.channel_id) || self.private_channels.get("id", data.channel_id);
					if (channel) {
						// potentially blank
						var msg = channel.messages.get("id", data.id);

						if (msg) {
							// old message exists
							data.nonce = data.nonce || msg.nonce;
							data.attachments = data.attachments || msg.attachments;
							data.tts = data.tts || msg.tts;
							data.embeds = data.embeds || msg.embeds;
							data.timestamp = data.timestamp || msg.timestamp;
							data.mention_everyone = data.mention_everyone || msg.everyoneMentioned;
							data.content = data.content || msg.content;
							data.mentions = data.mentions || msg.mentions;
							data.author = data.author || msg.author;
							var nmsg = new _StructuresMessage2["default"](data, channel, client);
							client.emit("messageUpdated", new _StructuresMessage2["default"](msg, channel, client), nmsg);
							channel.messages.update(msg, nmsg);
						}
					} else {
						client.emit("warn", "message was updated but channel is not cached");
					}
					break;
				case _Constants.PacketType.SERVER_CREATE:
					var server = self.servers.get("id", data.id);
					if (!server) {
						if (!data.unavailable) {
							server = new _StructuresServer2["default"](data, client);
							self.servers.add(server);
							client.emit("serverCreated", server);
						} else {
							client.emit("warn", "server was unavailable, could not create");
						}
					}
					break;
				case _Constants.PacketType.SERVER_DELETE:
					var server = self.servers.get("id", data.id);
					if (server) {
						if (!data.unavailable) {
							for (var _iterator5 = server.channels, _isArray5 = Array.isArray(_iterator5), _i5 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
								var _ref5;

								if (_isArray5) {
									if (_i5 >= _iterator5.length) break;
									_ref5 = _iterator5[_i5++];
								} else {
									_i5 = _iterator5.next();
									if (_i5.done) break;
									_ref5 = _i5.value;
								}

								var channel = _ref5;

								self.channels.remove(channel);
							}

							self.servers.remove(server);
							client.emit("serverDeleted", server);
						} else {
							client.emit("warn", "server was unavailable, could not update");
						}
					} else {
						client.emit("warn", "server was deleted but it was not in the cache");
					}
					break;
				case _Constants.PacketType.SERVER_UPDATE:
					var server = self.servers.get("id", data.id);
					if (server) {
						// server exists
						data.members = data.members || [];
						data.channels = data.channels || [];
						var newserver = new _StructuresServer2["default"](data, client);
						newserver.members = server.members;
						newserver.memberMap = server.memberMap;
						newserver.channels = server.channels;
						if (newserver.equalsStrict(server)) {
							// already the same don't do anything
							client.emit("debug", "received server update but server already updated");
						} else {
							client.emit("serverUpdated", new _StructuresServer2["default"](server, client), newserver);
							self.servers.update(server, newserver);
						}
					} else if (!server) {
						client.emit("warn", "server was updated but it was not in the cache");
						self.servers.add(new _StructuresServer2["default"](data, client));
						client.emit("serverCreated", server);
					}
					break;
				case _Constants.PacketType.CHANNEL_CREATE:

					var channel = self.channels.get("id", data.id);

					if (!channel) {

						var server = self.servers.get("id", data.guild_id);
						if (server) {
							var chan = null;
							if (data.type === "text") {
								chan = self.channels.add(new _StructuresTextChannel2["default"](data, client, server));
							} else {
								chan = self.channels.add(new _StructuresVoiceChannel2["default"](data, client, server));
							}
							client.emit("channelCreated", server.channels.add(chan));
						} else if (data.is_private) {
							client.emit("channelCreated", self.private_channels.add(new _StructuresPMChannel2["default"](data, client)));
						} else {
							client.emit("warn", "channel created but server does not exist");
						}
					} else {
						client.emit("warn", "channel created but already in cache");
					}

					break;
				case _Constants.PacketType.CHANNEL_DELETE:
					var channel = self.channels.get("id", data.id);
					if (channel) {

						if (channel.server) // accounts for PMs
							channel.server.channels.remove(channel);

						self.channels.remove(channel);
						client.emit("channelDeleted", channel);
					} else {
						client.emit("warn", "channel deleted but already out of cache?");
					}
					break;
				case _Constants.PacketType.CHANNEL_UPDATE:
					var channel = self.channels.get("id", data.id) || self.private_channels.get("id", data.id);
					if (channel) {

						if (channel instanceof _StructuresPMChannel2["default"]) {
							//PM CHANNEL
							client.emit("channelUpdated", new _StructuresPMChannel2["default"](channel, client), self.private_channels.update(channel, new _StructuresPMChannel2["default"](data, client)));
						} else {
							if (channel.server) {
								if (channel.type === "text") {
									//TEXT CHANNEL
									var chan = new _StructuresTextChannel2["default"](data, client, channel.server);
									chan.messages = channel.messages;
									client.emit("channelUpdated", channel, chan);
									channel.server.channels.update(channel, chan);
									self.channels.update(channel, chan);
								} else {
									//VOICE CHANNEL
									var chan = new _StructuresVoiceChannel2["default"](data, client, channel.server);
									client.emit("channelUpdated", channel, chan);
									channel.server.channels.update(channel, chan);
									self.channels.update(channel, chan);
								}
							} else {
								client.emit("warn", "channel updated but server non-existant");
							}
						}
					} else {
						client.emit("warn", "channel updated but not in cache");
					}
					break;
				case _Constants.PacketType.SERVER_ROLE_CREATE:
					var server = self.servers.get("id", data.guild_id);
					if (server) {
						client.emit("serverRoleCreated", server.roles.add(new _StructuresRole2["default"](data.role, server, client)), server);
					} else {
						client.emit("warn", "server role made but server not in cache");
					}
					break;
				case _Constants.PacketType.SERVER_ROLE_DELETE:
					var server = self.servers.get("id", data.guild_id);
					if (server) {
						var role = server.roles.get("id", data.role_id);
						if (role) {
							server.roles.remove(role);
							client.emit("serverRoleDeleted", role);
						} else {
							client.emit("warn", "server role deleted but role not in cache");
						}
					} else {
						client.emit("warn", "server role deleted but server not in cache");
					}
					break;
				case _Constants.PacketType.SERVER_ROLE_UPDATE:
					var server = self.servers.get("id", data.guild_id);
					if (server) {
						var role = server.roles.get("id", data.role.id);
						if (role) {
							var newRole = new _StructuresRole2["default"](data.role, server, client);
							client.emit("serverRoleUpdated", new _StructuresRole2["default"](role, server, client), newRole);
							server.roles.update(role, newRole);
						} else {
							client.emit("warn", "server role updated but role not in cache");
						}
					} else {
						client.emit("warn", "server role updated but server not in cache");
					}
					break;
				case _Constants.PacketType.SERVER_MEMBER_ADD:
					var server = self.servers.get("id", data.guild_id);
					if (server) {

						server.memberMap[data.user.id] = {
							roles: data.roles.map(function (pid) {
								return server.roles.get("id", pid);
							}),
							mute: false,
							self_mute: false,
							deaf: false,
							self_deaf: false,
							joinedAt: Date.parse(data.joined_at)
						};

						client.emit("serverNewMember", server, server.members.add(self.users.add(new _StructuresUser2["default"](data.user, client))));
					} else {
						client.emit("warn", "server member added but server doesn't exist in cache");
					}
					break;
				case _Constants.PacketType.SERVER_MEMBER_REMOVE:
					var server = self.servers.get("id", data.guild_id);
					if (server) {
						var user = self.users.get("id", data.user.id);
						if (user) {
							server.memberMap[data.user.id] = null;
							server.members.remove(user);
							client.emit("serverMemberRemoved", server, user);
						} else {
							client.emit("warn", "server member removed but user doesn't exist in cache");
						}
					} else {
						client.emit("warn", "server member removed but server doesn't exist in cache");
					}
					break;
				case _Constants.PacketType.SERVER_MEMBER_UPDATE:
					var server = self.servers.get("id", data.guild_id);
					if (server) {
						var user = self.users.get("id", data.user.id);
						if (user) {
							server.memberMap[data.user.id].roles = data.roles.map(function (pid) {
								return server.roles.get("id", pid);
							});
							server.memberMap[data.user.id].mute = data.mute;
							server.memberMap[data.user.id].self_mute = data.self_mute;
							server.memberMap[data.user.id].deaf = data.deaf;
							server.memberMap[data.user.id].self_deaf = data.self_deaf;
							client.emit("serverMemberUpdated", server, user);
						} else {
							client.emit("warn", "server member removed but user doesn't exist in cache");
						}
					} else {
						client.emit("warn", "server member updated but server doesn't exist in cache");
					}
					break;
				case _Constants.PacketType.PRESENCE_UPDATE:

					var user = self.users.get("id", data.user.id);

					if (user) {
						data.user.username = data.user.username || user.username;
						data.user.id = data.user.id || user.id;
						data.user.avatar = data.user.avatar || user.avatar;
						data.user.discriminator = data.user.discriminator || user.discriminator;
						data.user.status = data.status || user.status;
						data.user.game = data.game || user.game;

						var presenceUser = new _StructuresUser2["default"](data.user, client);

						if (!presenceUser.equalsStrict(user)) {
							client.emit("presence", user, presenceUser);
							self.users.update(user, presenceUser);
						}
					} else {
						client.emit("warn", "presence update but user not in cache");
					}

					break;
				case _Constants.PacketType.TYPING:

					var user = self.users.get("id", data.user_id);
					var channel = self.channels.get("id", data.channel_id) || self.private_channels.get("id", data.channel_id);

					if (user && channel) {
						if (user.typing.since) {
							user.typing.since = Date.now();
							user.typing.channel = channel;
						} else {
							user.typing.since = Date.now();
							user.typing.channel = channel;
							client.emit("userTypingStarted", user, channel);
						}
						setTimeout(function () {
							if (Date.now() - user.typing.since > 5500) {
								// they haven't typed since
								user.typing.since = null;
								user.typing.channel = null;
								client.emit("userTypingStopped", user, channel);
							}
						}, 6000);
					} else {
						client.emit("warn", "user typing but user or channel not existant in cache");
					}
					break;
				case _Constants.PacketType.SERVER_BAN_ADD:
					var user = self.users.get("id", data.user.id);
					var server = self.servers.get("id", data.guild_id);

					if (user && server) {
						client.emit("userBanned", user, server);
					} else {
						client.emit("warn", "user banned but user/server not in cache.");
					}
					break;
				case _Constants.PacketType.SERVER_BAN_REMOVE:
					var user = self.users.get("id", data.user.id);
					var server = self.servers.get("id", data.guild_id);

					if (user && server) {
						client.emit("userUnbanned", user, server);
					} else {
						client.emit("warn", "user unbanned but user/server not in cache.");
					}
					break;
				case _Constants.PacketType.VOICE_STATE_UPDATE:

					var user = self.users.get("id", data.user_id);
					var server = self.servers.get("id", data.guild_id);

					if (user && server) {

						if (data.channel_id) {
							// in voice channel
							var channel = self.channels.get("id", data.channel_id);
							if (channel && channel.type === "voice") {
								server.eventVoiceStateUpdate(channel, user, data);
							} else {
								client.emit("warn", "voice state channel not in cache");
							}
						} else {
							// not in voice channel
							client.emit("voiceLeave", server.eventVoiceLeave(user), user);
						}
					} else {
						client.emit("warn", "voice state update but user or server not in cache");
					}

					break;
				default:
					client.emit("unknown", packet);
					break;
			}
		};
	};

	_createClass(InternalClient, [{
		key: "uptime",
		get: function get() {
			return this.readyTime ? Date.now() - this.readyTime : null;
		}
	}, {
		key: "userAgent",
		set: function set(info) {
			info.full = "DiscordBot (" + info.url + ", " + info.version + ")";
			this.userAgentInfo = info;
		},
		get: function get() {
			return this.userAgentInfo;
		}
	}]);

	return InternalClient;
})();

exports["default"] = InternalClient;
module.exports = exports["default"];
