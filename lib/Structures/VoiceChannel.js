"use strict";

exports.__esModule = true;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _ServerChannel2 = require("./ServerChannel");

var _ServerChannel3 = _interopRequireDefault(_ServerChannel2);

var _UtilCache = require("../Util/Cache");

var _UtilCache2 = _interopRequireDefault(_UtilCache);

var _UtilArgumentRegulariser = require("../Util/ArgumentRegulariser");

var VoiceChannel = (function (_ServerChannel) {
	_inherits(VoiceChannel, _ServerChannel);

	function VoiceChannel(data, client, server) {
		_classCallCheck(this, VoiceChannel);

		_ServerChannel.call(this, data, client, server);
		this.members = new _UtilCache2["default"]();
	}

	VoiceChannel.prototype.join = function join() {
		var callback = arguments.length <= 0 || arguments[0] === undefined ? function () {} : arguments[0];

		return this.client.joinVoiceChannel.apply(this.client, [this, callback]);
	};

	return VoiceChannel;
})(_ServerChannel3["default"]);

exports["default"] = VoiceChannel;
module.exports = exports["default"];
