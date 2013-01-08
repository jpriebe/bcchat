/** Example Titanium View
 * Copy build/bcc.js and lib/ti-websocket-client into your project's Resources folder
 */

var TU = require ('/TitanUp/TitanUp');

function FirstView() {
    var _self = Ti.UI.createView ({
        backgroundColor: TU.UI.Theme.backgroundColor
    });

    var _myuuid = Ti.Platform.createUUID ();
    
    var dw = TU.Device.getDisplayWidth ();
    var dh = TU.Device.getDisplayHeight ();
    
    var margin = TU.UI.Sizer.getDimension (10);
    var btnw = TU.UI.Sizer.getDimension (50);
    
    var BCFeed = require ('/util/BCFeed');
    var _bcfeed = new BCFeed ();
    
    var _container = Ti.UI.createView ({
        height: btnw,
        layout: 'horizontal',
        left: margin,
        right: margin,
        top: margin
    });

    var _tf = Ti.UI.createTextField ({
        backgroundColor: TU.UI.Theme.lightBackgroundColor,
        borderColor: TU.UI.Theme.textColor,
        width: dw - 3 * margin - 1 * btnw,
        height: btnw
    });
    
    _container.add (_tf);

    var _btnSend = Ti.UI.createButton ({
        width: btnw,
        height: btnw,
        left: margin,
        image: '/images/chat-2.png'
    });
    
    _btnSend.addEventListener ('click', function (e) {
        var strmsg = _tf.getValue ();
        
        var bundle = {
            sender: _myuuid,
            text: strmsg  
        };
        
        Ti.API.info ("sending message..."); 
        _bcfeed.send (bundle);
        
        _tf.setValue ('');
    });
    
    _container.add (_btnSend);
    
    _self.add (_container);

    var _tvmsgs = Ti.UI.createTableView ({
       top: 2 * margin + btnw,
       left: margin,
       right: margin,
       bottom: margin,
       borderColor: TU.UI.Theme.textColor,
       backgroundColor: TU.UI.Theme.lightBackgroundColor
    });
    
    _self.add (_tvmsgs);

    Ti.App.addEventListener ('BCFeedMsgReceived', function (msg) {
        Ti.API.info ("[addMessage] received message...");
        addMessage (msg);
    });


    function addMessage (msg)
    {
        var strmsg = msg.text;
        if (strmsg.length > 0 && (msg.sender == _myuuid))
        {
            strmsg = "> " + strmsg;
        }
        
        var params = {
            title: strmsg,
            backgroundColor: TU.UI.Theme.lightBackgroundColor,
            color: TU.UI.Theme.textColor
        };
        
        var tvr = Ti.UI.createTableViewRow (params);
        
        var rows = _tvmsgs.getData ();
        
        if (rows.length > 40)
        {
            rows.pop ();
        }
        rows.unshift (tvr);
        
        _tvmsgs.setData (rows);
    }

    return _self;
}


module.exports = FirstView;