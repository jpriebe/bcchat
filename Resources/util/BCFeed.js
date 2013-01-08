var _instance = {};

/** Opens a feed for an example Thru Channel */
function _init () {
    _instance = {};
    
    // load brightcontext
    var _bcc = require('/util/bcc');

    // inject Titanium polyfills for WebSocket and XMLHttpRequest
    _bcc.WebSocket = require('/util/ti-websocket-client').WebSocket;
    _bcc.XMLHttpRequest = Titanium.Network.createHTTPClient;

    // force off Flash and Streaming, they won't work in Titanium apps
    _bcc.Env.FORCE_FLASHSOCKETS_OFF = true;
    _bcc.Env.FORCE_FLASHGATEWAY_OFF = true;
    _bcc.Env.FORCE_STREAMING_OFF = true;

    // turn on debug logging
    _bcc.setLogLevel(_bcc.LogLevel.DEBUG);

    // initialize the context with your API Key
    // you should only call init() once during your apps lifecycle
    // multiple calls to init() will force a shutdown of any existing context
    var _bcctx = _bcc.init('YOUR_API_KEY_HERE');

    // open the project
    var _bcproj = _bcctx.project('BCTitaniumTest');
    
    Ti.API.debug ('[BCFeed] initializing connection to BCTitaniumTest');

    // sequester a channel and open the data feed
    var _bcfeed = _bcproj.feed({
        channel: 'TestChannel',
        
        onopen: function(f) {
            Ti.API.debug ('[BCFeed] BCC.Feed.onopen');
        },
        
        onmsgreceived: function(thrufeed, message) {
            Ti.API.debug ('[BCFeed] BCC.Feed.onmsgreceived: ' + message);

            Ti.App.fireEvent ("BCFeedMsgReceived", message);
        },
        
        onclose: function() {
            Ti.API.debug ('[BCFeed] BCC.Feed.onclose');
        },
        
        onmsgsent: function(feed, message) {
            Ti.API.debug ('[BCFeed] BCC.Feed.onmsgsent: ' + message);
        },
        
        onerror: function (error) {
            Ti.API.debug ('[BCFeed] BCC.Feed.onerror: ' + error);
        }
    });

    _instance.send = function (message)
    {
        Ti.API.debug ('[BCFeed.send] sending message...');
        _bcfeed.send (message);
    }

    _instance.close = function ()
    {
        _bcfeed.close();
    }
};

_init ();

function BCFeed ()
{
    return _instance;
}

module.exports = BCFeed;
